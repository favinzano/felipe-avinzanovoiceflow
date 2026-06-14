using System.Runtime.InteropServices;
using System.Text.Json;

internal static class Program
{
    private const uint InputKeyboard = 1;
    private const ushort KeyControl = 0x11;
    private const ushort KeyV = 0x56;
    private const uint KeyUp = 0x0002;

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
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, Input[] inputs, int size);

    private static void Write(object value) => Console.WriteLine(JsonSerializer.Serialize(value));

    private static int Capture()
    {
        var handle = GetForegroundWindow();
        GetWindowThreadProcessId(handle, out var processId);
        Write(new { ok = handle != IntPtr.Zero && processId > 0, handle = handle.ToInt64(), processId });
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

        ShowWindowAsync(handle, 9);
        var targetThread = GetWindowThreadProcessId(handle, out _);
        var currentThread = GetCurrentThreadId();
        var attached = targetThread != currentThread && AttachThreadInput(currentThread, targetThread, true);
        var focused = SetForegroundWindow(handle);
        if (attached) AttachThreadInput(currentThread, targetThread, false);
        if (!focused && GetForegroundWindow() != handle)
        {
            Write(new { ok = false, error = "focus_denied" });
            return 4;
        }
        Thread.Sleep(100);
        var inputs = new[]
        {
            Key(KeyControl, 0),
            Key(KeyV, 0),
            Key(KeyV, KeyUp),
            Key(KeyControl, KeyUp)
        };
        var sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<Input>());
        Write(new { ok = sent == (uint)inputs.Length, sent, expected = inputs.Length, error = sent == (uint)inputs.Length ? null : "send_input_denied" });
        return sent == (uint)inputs.Length ? 0 : 5;
    }

    private static Input Key(ushort key, uint flags) => new()
    {
        type = InputKeyboard,
        union = new InputUnion { keyboard = new KeyboardInput { virtualKey = key, flags = flags } }
    };

    public static int Main(string[] args)
    {
        try
        {
            return args.FirstOrDefault() switch
            {
                "capture" => Capture(),
                "paste" => Paste(args),
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
