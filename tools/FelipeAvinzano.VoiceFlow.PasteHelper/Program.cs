using System.Runtime.InteropServices;
using System.Text.Json;

internal static class Program
{
    private const int HookKeyboardLowLevel = 13;
    private const int MessageKeyDown = 0x0100;
    private const int MessageKeyUp = 0x0101;
    private const int MessageSystemKeyDown = 0x0104;
    private const int MessageSystemKeyUp = 0x0105;
    private const uint InputKeyboard = 1;
    private const ushort KeyControl = 0x11;
    private const ushort KeyV = 0x56;
    private const uint KeyUp = 0x0002;
    private static KeyboardHook? keyboardHook;
    private static IntPtr keyboardHookHandle;
    private static ushort monitoredKey;
    private static bool requireControl;
    private static bool requireShift;
    private static bool requireAlt;
    private static bool shortcutPressed;

    private delegate IntPtr KeyboardHook(int code, IntPtr message, IntPtr data);

    [StructLayout(LayoutKind.Sequential)]
    private struct Message
    {
        public IntPtr window;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int pointX;
        public int pointY;
        public uint privateValue;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rectangle
    {
        public int left;
        public int top;
        public int right;
        public int bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct GuiThreadInfo
    {
        public int size;
        public uint flags;
        public IntPtr activeWindow;
        public IntPtr focusedWindow;
        public IntPtr captureWindow;
        public IntPtr menuOwnerWindow;
        public IntPtr moveSizeWindow;
        public IntPtr caretWindow;
        public Rectangle caretRectangle;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LowLevelKeyboardInput
    {
        public uint virtualKey;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Input
    {
        public uint type;
        public InputUnion union;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public KeyboardInput keyboard;
        [FieldOffset(0)] public MouseInput mouse;
    }

    // INPUT's native union is sized by MOUSEINPUT (32 bytes on x64), even
    // when SendInput receives keyboard events. Omitting this member shrinks
    // INPUT to 32 bytes instead of the required 40 and SendInput returns 0.
    [StructLayout(LayoutKind.Sequential)]
    private struct MouseInput
    {
        public int x;
        public int y;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr extraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardInput
    {
        public ushort virtualKey;
        public ushort scanCode;
        public uint flags;
        public uint time;
        public IntPtr extraInfo;
    }

    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint first, uint second, bool attach);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr SetFocus(IntPtr window);
    [DllImport("user32.dll")] private static extern bool GetGUIThreadInfo(uint threadId, ref GuiThreadInfo info);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, Input[] inputs, int size);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int hook, KeyboardHook callback, IntPtr module, uint threadId);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int virtualKey);
    [DllImport("user32.dll")] private static extern int GetMessage(out Message message, IntPtr window, uint minimum, uint maximum);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out Message message, IntPtr window, uint filterMin, uint filterMax, uint removeMessage);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? moduleName);

    private const uint PeekMessageRemove = 0x0001;

    // A plain Thread.Sleep here blocks this thread while AttachThreadInput has
    // merged its input queue with the target's, and Windows' hang/ghosting
    // detection watches every thread sharing an attached queue -- not just the
    // target's own -- so a blocked helper thread can make the *target* window
    // flash "(No responde)" even though the target itself never stalled.
    // Pumping this thread's own message queue during the wait keeps it
    // demonstrably alive without shortening the drain window the "bare v" fix
    // (91446a9) depends on.
    private static void PumpingWait(int milliseconds)
    {
        var deadline = Environment.TickCount64 + milliseconds;
        do
        {
            while (PeekMessage(out var message, IntPtr.Zero, 0, 0, PeekMessageRemove))
            {
                TranslateMessage(ref message);
                DispatchMessage(ref message);
            }
            Thread.Sleep(1);
        } while (Environment.TickCount64 < deadline);
    }

    private static void Write(object value) => Console.WriteLine(JsonSerializer.Serialize(value));

    private static int Capture()
    {
        var handle = GetForegroundWindow();
        var threadId = GetWindowThreadProcessId(handle, out var processId);
        var info = new GuiThreadInfo { size = Marshal.SizeOf<GuiThreadInfo>() };
        var focusHandle = GetGUIThreadInfo(threadId, ref info) ? info.focusedWindow : IntPtr.Zero;
        Write(new { ok = handle != IntPtr.Zero && processId > 0, handle = handle.ToInt64(), focusHandle = focusHandle.ToInt64(), processId });
        return handle != IntPtr.Zero && processId > 0 ? 0 : 2;
    }

    private static int Paste(string[] args)
    {
        var handleArgument = Array.IndexOf(args, "--handle");
        if (handleArgument < 0 || handleArgument + 1 >= args.Length || !long.TryParse(args[handleArgument + 1], out var handleValue))
        {
            Write(new { ok = false, error = "missing_handle" });
            return 2;
        }
        var handle = new IntPtr(handleValue);
        if (!IsWindow(handle))
        {
            Write(new { ok = false, error = "invalid_window" });
            return 3;
        }
        var processArgument = Array.IndexOf(args, "--process");
        if (processArgument < 0 || processArgument + 1 >= args.Length || !uint.TryParse(args[processArgument + 1], out var expectedProcessId))
        {
            Write(new { ok = false, error = "missing_process" });
            return 2;
        }
        GetWindowThreadProcessId(handle, out var actualProcessId);
        if (actualProcessId != expectedProcessId)
        {
            Write(new { ok = false, error = "window_owner_changed" });
            return 3;
        }

        var focusArgument = Array.IndexOf(args, "--focus");
        var focusHandle = focusArgument >= 0
            && focusArgument + 1 < args.Length
            && long.TryParse(args[focusArgument + 1], out var focusValue)
            ? new IntPtr(focusValue)
            : IntPtr.Zero;
        if (focusHandle != IntPtr.Zero)
        {
            GetWindowThreadProcessId(focusHandle, out var focusProcessId);
            if (!IsWindow(focusHandle) || focusProcessId != expectedProcessId) focusHandle = IntPtr.Zero;
        }

        // SW_RESTORE (9) un-minimizes, but Windows also treats it as "undo maximize"
        // on a window that isn't minimized: calling it unconditionally shrank
        // maximized target windows on every paste. Only restore when the window is
        // actually iconic so a normal or maximized window is left untouched.
        if (IsIconic(handle)) ShowWindowAsync(handle, 9);
        var targetThread = GetWindowThreadProcessId(handle, out _);
        var foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out _);
        var currentThread = GetCurrentThreadId();
        var attachedToForeground = foregroundThread != 0 && foregroundThread != currentThread
            && AttachThreadInput(currentThread, foregroundThread, true);
        var attachedToTarget = targetThread != currentThread && targetThread != foregroundThread
            && AttachThreadInput(currentThread, targetThread, true);
        BringWindowToTop(handle);
        SetForegroundWindow(handle);
        var setFocusResult = focusHandle != IntPtr.Zero ? SetFocus(focusHandle) : IntPtr.Zero;
        var setFocusError = focusHandle != IntPtr.Zero && setFocusResult == IntPtr.Zero ? Marshal.GetLastWin32Error() : 0;
        PumpingWait(120);
        var foregroundHandle = GetForegroundWindow();
        var infoAfterFocus = new GuiThreadInfo { size = Marshal.SizeOf<GuiThreadInfo>() };
        GetGUIThreadInfo(targetThread, ref infoAfterFocus);
        var actualFocusHandle = infoAfterFocus.focusedWindow;
        if (foregroundHandle != handle)
        {
            if (attachedToTarget) AttachThreadInput(currentThread, targetThread, false);
            if (attachedToForeground) AttachThreadInput(currentThread, foregroundThread, false);
            Write(new { ok = false, foregroundHandle = foregroundHandle.ToInt64(), error = "focus_denied" });
            return 4;
        }
        var inputs = new[]
        {
            Key(KeyControl, 0),
            Key(KeyV, 0),
            Key(KeyV, KeyUp),
            Key(KeyControl, KeyUp)
        };
        var sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<Input>());
        var win32Error = sent == (uint)inputs.Length ? 0 : Marshal.GetLastWin32Error();
        // SendInput only queues the keystrokes; it returns before the target thread's
        // message loop actually dequeues and processes them. Detaching thread input
        // right away can race that processing -- if the target is still catching up
        // (e.g. CPU was pegged by a long Whisper transcription right before this ran),
        // the shared modifier-key state can disappear before the V keydown is handled,
        // so the target sees a bare "v" instead of Ctrl+V. Give the queue a moment to
        // drain before tearing down the attachment.
        PumpingWait(50);
        if (attachedToTarget) AttachThreadInput(currentThread, targetThread, false);
        if (attachedToForeground) AttachThreadInput(currentThread, foregroundThread, false);
        Write(new
        {
            ok = sent == (uint)inputs.Length,
            sent,
            expected = inputs.Length,
            inputSize = Marshal.SizeOf<Input>(),
            win32Error,
            error = sent == (uint)inputs.Length ? null : "send_input_denied",
            attachedToTarget,
            attachedToForeground,
            requestedFocusHandle = focusHandle.ToInt64(),
            setFocusPreviousHandle = setFocusResult.ToInt64(),
            setFocusError,
            actualFocusHandleAfterSetFocus = actualFocusHandle.ToInt64(),
            focusMatched = focusHandle == IntPtr.Zero || actualFocusHandle == focusHandle
        });
        return sent == (uint)inputs.Length ? 0 : 5;
    }

    private static bool IsDown(int virtualKey) => (GetAsyncKeyState(virtualKey) & 0x8000) != 0;

    private static ushort ResolveVirtualKey(string? keyName)
    {
        if (keyName?.Equals("Space", StringComparison.OrdinalIgnoreCase) == true) return 0x20;
        if (keyName?.Length == 1 && char.IsAsciiLetterOrDigit(keyName[0])) return char.ToUpperInvariant(keyName[0]);
        return 0;
    }

    private static IntPtr MonitorKeyboard(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0)
        {
            var input = Marshal.PtrToStructure<LowLevelKeyboardInput>(data);
            if (input.virtualKey == monitoredKey)
            {
                var value = message.ToInt32();
                var isDown = value is MessageKeyDown or MessageSystemKeyDown;
                var isUp = value is MessageKeyUp or MessageSystemKeyUp;
                var modifiersMatch = IsDown(KeyControl) == requireControl
                    && IsDown(0x10) == requireShift
                    && IsDown(0x12) == requireAlt;

                if (isDown && modifiersMatch && !shortcutPressed)
                {
                    shortcutPressed = true;
                    Write(new { type = "pressed" });
                }
                else if (isUp && shortcutPressed)
                {
                    shortcutPressed = false;
                    Write(new { type = "released" });
                }
            }
        }
        return CallNextHookEx(keyboardHookHandle, code, message, data);
    }

    private static int Monitor(string[] args)
    {
        var acceleratorArgument = Array.IndexOf(args, "--accelerator");
        if (acceleratorArgument < 0 || acceleratorArgument + 1 >= args.Length) return 2;

        var parts = args[acceleratorArgument + 1].Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var modifiers = new[] { "Control", "Ctrl", "CommandOrControl", "Shift", "Alt" };
        requireControl = parts.Any(part => part.Equals("Control", StringComparison.OrdinalIgnoreCase)
            || part.Equals("Ctrl", StringComparison.OrdinalIgnoreCase)
            || part.Equals("CommandOrControl", StringComparison.OrdinalIgnoreCase));
        requireShift = parts.Any(part => part.Equals("Shift", StringComparison.OrdinalIgnoreCase));
        requireAlt = parts.Any(part => part.Equals("Alt", StringComparison.OrdinalIgnoreCase));
        var keyName = parts.LastOrDefault(part => !modifiers.Contains(part, StringComparer.OrdinalIgnoreCase));
        monitoredKey = ResolveVirtualKey(keyName);
        if (monitoredKey == 0) return 2;

        keyboardHook = MonitorKeyboard;
        keyboardHookHandle = SetWindowsHookEx(HookKeyboardLowLevel, keyboardHook, GetModuleHandle(null), 0);
        if (keyboardHookHandle == IntPtr.Zero)
        {
            Write(new { type = "error", error = Marshal.GetLastWin32Error() });
            return 3;
        }

        Write(new { type = "ready" });
        try
        {
            while (GetMessage(out _, IntPtr.Zero, 0, 0) > 0) { }
        }
        finally
        {
            UnhookWindowsHookEx(keyboardHookHandle);
        }
        return 0;
    }

    private static Input Key(ushort key, uint flags) => new()
    {
        type = InputKeyboard,
        union = new InputUnion { keyboard = new KeyboardInput { virtualKey = key, flags = flags } }
    };

    private static int SelfTest()
    {
        var inputSize = Marshal.SizeOf<Input>();
        var expectedInputSize = IntPtr.Size == 8 ? 40 : 28;
        var ok = inputSize == expectedInputSize;
        Write(new { ok, inputSize, expectedInputSize, pointerSize = IntPtr.Size });
        return ok ? 0 : 6;
    }

    public static int Main(string[] args)
    {
        try
        {
            return args.FirstOrDefault() switch
            {
                "capture" => Capture(),
                "paste" => Paste(args),
                "self-test" => SelfTest(),
                "monitor-shortcut" => Monitor(args),
                _ => 2
            };
        }
        catch (Exception error)
        {
            Write(new { ok = false, error = error.Message });
            return 1;
        }
    }
}
