Option Explicit

Dim shell, fso, appDir, electronPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronPath = fso.BuildPath(appDir, "node_modules\electron\dist\electron.exe")

If Not fso.FileExists(electronPath) Then
  MsgBox "Electron is not installed. Run install.cmd first.", 16, "Nevo"
  WScript.Quit 1
End If

command = Chr(34) & electronPath & Chr(34) & " " & Chr(34) & appDir & Chr(34)
shell.CurrentDirectory = appDir
shell.Run command, 1, False
