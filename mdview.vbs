' Hidden launcher: runs mdview without flashing a console window. Extra arguments (--theme etc.) are passed through.
Set sh = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
If WScript.Arguments.Count = 0 Then WScript.Quit 1
args = ""
For i = 0 To WScript.Arguments.Count - 1
  args = args & " """ & WScript.Arguments(i) & """"
Next
sh.Run "node """ & here & "\mdview.mjs""" & args, 0, False
