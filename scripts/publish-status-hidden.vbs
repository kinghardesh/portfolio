' Runs publish-status.mjs once with no console window. Used by the "Portfolio status push"
' scheduled task. Output of the most recent run goes to logs\status-last.log.
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
If Not fso.FolderExists(root & "\logs") Then fso.CreateFolder(root & "\logs")

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = root
shell.Run "cmd /c ""node --env-file=.env.status scripts\publish-status.mjs > logs\status-last.log 2>&1""", 0, False
