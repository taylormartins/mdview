' Hidden launcher: runs mdview without flashing a console window.
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "node """ & here & "\mdview.mjs"" """ & WScript.Arguments(0) & """", 0, False
