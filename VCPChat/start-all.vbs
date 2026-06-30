Set WshShell = CreateObject("WScript.Shell")
Set WshEnv = WshShell.Environment("Process")
projectPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
runtimesBase = projectPath & "\..\runtimes"
WshEnv("PATH") = runtimesBase & "\node;" & runtimesBase & "\git\cmd;" & runtimesBase & "\python;" & runtimesBase & "\python\Scripts;" & WshEnv("PATH")
WshShell.CurrentDirectory = projectPath

' Launch main VCPChat window with splash
WshShell.Run "cmd /c START """" ""NativeSplash.exe"" && npx electron .", 0, False

' Wait for .vcp_ready signal (max 60s)
Set fso = CreateObject("Scripting.FileSystemObject")
readyFile = projectPath & "\.vcp_ready"
waited = 0
Do While Not fso.FileExists(readyFile) And waited < 60
    WScript.Sleep 1000
    waited = waited + 1
Loop

If fso.FileExists(readyFile) Then
    fso.DeleteFile readyFile, True
    WScript.Sleep 1000
    ' Launch desktop widget
    WshShell.Run "cmd /c npx electron . --desktop-only", 0, False
End If
