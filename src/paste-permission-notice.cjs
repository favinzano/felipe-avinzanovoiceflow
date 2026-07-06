'use strict';

const { getPastePermissionNoticeDismissed, setPastePermissionNoticeDismissed } = require('./app-preferences.cjs');

const MAC_ACCESSIBILITY_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

const DIALOG_COPY_BY_PLATFORM = {
  darwin: {
    message: 'No se pudo pegar automáticamente: falta el permiso de Accesibilidad.',
    detail: 'Concede acceso en Ajustes del Sistema > Privacidad y seguridad > Accesibilidad y vuelve a intentarlo. El texto ya quedó copiado en el portapapeles.',
    settingsUrl: MAC_ACCESSIBILITY_SETTINGS_URL
  },
  linux: {
    message: 'No se pudo pegar automáticamente en este entorno.',
    detail: 'Revisa los permisos de accesibilidad/entrada de tu entorno de escritorio (X11/Wayland). El texto ya quedó copiado en el portapapeles.',
    settingsUrl: undefined
  }
};

// Callers are expected to invoke this only when a paste already failed with reason
// permission-denied; this module owns just the "how do we tell the user" part. Shown at
// most once per install regardless of which button is clicked — renagging on every
// failed paste would be worse than the silent failure it replaces. Dismissal is persisted
// via app-preferences.cjs so it survives restarts.
async function notifyPastePermissionDenied({ platform, userDataPath, dialogApi, shellApi }) {
  const copy = DIALOG_COPY_BY_PLATFORM[platform];
  if (!copy) return;
  if (getPastePermissionNoticeDismissed(userDataPath)) return;

  const buttons = copy.settingsUrl ? ['Abrir Ajustes', 'Ahora no'] : ['Entendido'];
  const { response } = await dialogApi.showMessageBox({
    type: 'info',
    title: 'Falta un permiso para pegar automáticamente',
    message: copy.message,
    detail: copy.detail,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1
  });
  setPastePermissionNoticeDismissed(userDataPath, true);
  if (copy.settingsUrl && response === 0) shellApi.openExternal(copy.settingsUrl);
}

module.exports = { notifyPastePermissionDenied };
