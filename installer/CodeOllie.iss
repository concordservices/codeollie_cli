#define AppName "CodeOllie CLI"
#define AppVersion "1.0.0"

[Setup]
AppId={{A63DA331-A7FD-46AE-A9C9-7C86259B3C99}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Concord Services
DefaultDirName={autopf}\CodeOllie
DefaultGroupName=CodeOllie CLI
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
OutputDir=..
OutputBaseFilename=CodeOllie-Setup-64bit
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#AppName}

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "..\CodeOllie.exe"; DestDir: "{app}"; DestName: "codeollie.exe"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\CodeOllie CLI"; Filename: "{app}\codeollie.exe"
Name: "{autodesktop}\CodeOllie CLI"; Filename: "{app}\codeollie.exe"; Tasks: desktopicon

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    MsgBox('CodeOllie CLI has been installed successfully.', mbInformation, MB_OK);
end;
