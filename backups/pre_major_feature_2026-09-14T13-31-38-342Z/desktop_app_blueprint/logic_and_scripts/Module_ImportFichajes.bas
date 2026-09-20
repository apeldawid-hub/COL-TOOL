Attribute VB_Name = "Module_ImportFichajes"
Option Explicit

' ==============================================================================
' STARBUCKS COFFEE COMPANY — TPLH FORECAST & LABOR BALANCING (2021–2036)
' Moduł: Module_ImportFichajes
'
' Zawartość:
' 1. ImportujRaportFichajes() — import logowań z raportu MAPAL (.xls / .xlsx)
' 2. PrzelaczArkuszAOP()      — odkrywa bazę AOP i przełącza widok
' 3. PrzelaczArkuszLaborDB()  — odkrywa bazę logowań RCP i przełącza widok
' 4. PrzelaczArkuszFloor()    — odkrywa parametry Floor Hours
' 5. WrocDoDashboardu()       — powrót do pulpitu i ukrycie arkuszy roboczych
' 6. UkryjWszystkieSilniki()  — tryb jednotabelowy (kioskowy)
' ==============================================================================

' ------------------------------------------------------------------------------
' 1. IMPORT LOGOWAŃ MAPAL (FICHAJES)
' ------------------------------------------------------------------------------
Public Sub ImportujRaportFichajes()
    Dim filePath As String
    Dim srcWb As Workbook
    Dim srcWs As Worksheet
    Dim destWb As Workbook
    Dim dbWs As Worksheet
    Dim calWs As Worksheet
    Dim lastRowSrc As Long, lastRowDb As Long
    Dim r As Long, countImported As Long
    Dim bDayVal As Variant, empName As String, catName As String
    Dim contractType As String, compTime As Double, unitCode As String, unitName As String
    Dim bDate As Date, dStr As String
    Dim calRok As Variant, calMsc As Variant, calTydzien As Variant, calKlucz As Variant, calDzien As Variant
    Dim calRow As Variant
    Dim importTimeStr As String
    Dim minDate As Date, maxDate As Date
    Dim firstDateSet As Boolean
    
    On Error GoTo ErrorHandler
    
    ' Wybór pliku raportu MAPAL (.xls / .xlsx)
    #If Mac Then
        On Error Resume Next
        filePath = MacScript("choose file of type {""com.microsoft.excel.xls"", ""org.openxmlformats.spreadsheetml.sheet"", ""com.microsoft.excel.openxmlspreadsheet""} with prompt ""Wybierz raport MAPAL Fichajes (.xls / .xlsx)"" as string")
        On Error GoTo ErrorHandler
        If filePath = "" Then Exit Sub
    #Else
        filePath = Application.GetOpenFilename("Pliki Excel (*.xls;*.xlsx),*.xls;*.xlsx", , "Wybierz raport MAPAL Fichajes")
        If filePath = "False" Or filePath = "" Then Exit Sub
    #End If
    
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    Application.Calculation = xlCalculationManual
    
    Set destWb = ThisWorkbook
    Set dbWs = destWb.Sheets("Labor Actuals DB")
    Set calWs = destWb.Sheets("Calendar Engine")
    
    ' Otwarcie pliku raportu
    Set srcWb = Workbooks.Open(Filename:=filePath, ReadOnly:=True)
    Set srcWs = srcWb.Sheets(1)
    
    lastRowSrc = srcWs.Cells(srcWs.Rows.Count, "D").End(xlUp).Row
    If lastRowSrc < 8 Then
        srcWb.Close SaveChanges:=False
        MsgBox "Plik nie zawiera oczekiwanych danych logowań (brak wierszy od wiersza 8).", vbExclamation, "Błąd importu"
        GoTo CleanExit
    End If
    
    importTimeStr = Format(Now, "yyyy-mm-dd hh:nn")
    firstDateSet = False
    
    ' Przebieg 1: Określenie zakresu dat dla kawiarni 108120 SBX Warszawa Janki
    For r = 8 To lastRowSrc
        unitName = CStr(srcWs.Cells(r, 16).Value)
        If InStr(unitName, "108120") > 0 Or InStr(LCase(unitName), "janki") > 0 Then
            bDayVal = srcWs.Cells(r, 7).Value
            If IsDate(bDayVal) Then
                bDate = CDate(bDayVal)
                If Not firstDateSet Then
                    minDate = bDate
                    maxDate = bDate
                    firstDateSet = True
                Else
                    If bDate < minDate Then minDate = bDate
                    If bDate > maxDate Then maxDate = bDate
                End If
            End If
        End If
    Next r
    
    If Not firstDateSet Then
        srcWb.Close SaveChanges:=False
        MsgBox "W wybranym raporcie nie znaleziono żadnych wpisów dla kawiarni 108120 SBX Warszawa Janki.", vbInformation, "Brak danych Janki"
        GoTo CleanExit
    End If
    
    ' Ochrona przed dublowaniem: usunięcie wcześniejszych wpisów dla tego zakresu dat
    lastRowDb = dbWs.Cells(dbWs.Rows.Count, "B").End(xlUp).Row
    If lastRowDb >= 2 Then
        For r = lastRowDb To 2 Step -1
            If IsDate(dbWs.Cells(r, 2).Value) Then
                bDate = CDate(dbWs.Cells(r, 2).Value)
                If bDate >= minDate And bDate <= maxDate Then
                    dbWs.Rows(r).Delete
                End If
            End If
        Next r
    End If
    
    ' Przebieg 2: Zasilenie bazy Labor Actuals DB (pomijając pusty wiersz 7)
    lastRowDb = dbWs.Cells(dbWs.Rows.Count, "B").End(xlUp).Row
    countImported = 0
    
    For r = 8 To lastRowSrc
        unitName = CStr(srcWs.Cells(r, 16).Value)
        If InStr(unitName, "108120") > 0 Or InStr(LCase(unitName), "janki") > 0 Then
            bDayVal = srcWs.Cells(r, 7).Value
            If IsDate(bDayVal) Then
                bDate = CDate(bDayVal)
                dStr = Format(bDate, "yyyy-mm-dd")
                
                empName = Trim(CStr(srcWs.Cells(r, 4).Value))
                catName = Trim(CStr(srcWs.Cells(r, 5).Value))
                contractType = Trim(CStr(srcWs.Cells(r, 6).Value))
                compTime = Val(srcWs.Cells(r, 10).Value)
                unitCode = Trim(CStr(srcWs.Cells(r, 15).Value))
                
                ' Pobranie tygodnia z Calendar Engine
                calRow = Application.Match(CDbl(bDate), calWs.Columns(1), 0)
                If Not IsError(calRow) Then
                    calRok = calWs.Cells(calRow, 5).Value
                    calMsc = calWs.Cells(calRow, 6).Value
                    calDzien = calWs.Cells(calRow, 7).Value
                    calTydzien = calWs.Cells(calRow, 9).Value
                    calKlucz = calWs.Cells(calRow, 10).Value
                Else
                    calRok = Year(bDate)
                    calMsc = MonthName(Month(bDate))
                    calDzien = ""
                    calTydzien = ""
                    calKlucz = ""
                End If
                
                lastRowDb = lastRowDb + 1
                dbWs.Cells(lastRowDb, 1).Value = lastRowDb - 1
                dbWs.Cells(lastRowDb, 2).Value = dStr
                dbWs.Cells(lastRowDb, 3).Value = calRok
                dbWs.Cells(lastRowDb, 4).Value = calMsc
                dbWs.Cells(lastRowDb, 5).Value = calTydzien
                dbWs.Cells(lastRowDb, 6).Value = calKlucz
                dbWs.Cells(lastRowDb, 7).Value = calDzien
                dbWs.Cells(lastRowDb, 8).Value = empName
                dbWs.Cells(lastRowDb, 9).Value = catName
                dbWs.Cells(lastRowDb, 10).Value = contractType
                dbWs.Cells(lastRowDb, 11).Value = compTime
                dbWs.Cells(lastRowDb, 12).Value = unitCode
                dbWs.Cells(lastRowDb, 13).Value = unitName
                dbWs.Cells(lastRowDb, 14).Value = importTimeStr
                
                countImported = countImported + 1
            End If
        End If
    Next r
    
    srcWb.Close SaveChanges:=False
    
    ' Odświeżenie kalkulacji
    Application.Calculation = xlCalculationAutomatic
    destWb.Calculate
    
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    
    MsgBox "Import zakończony pełnym sukcesem!" & vbCrLf & vbCrLf & _
           "Kawiarnia: 108120 SBX Warszawa Janki" & vbCrLf & _
           "Zaimportowano wpisów: " & countImported & vbCrLf & _
           "Zakres dat: " & Format(minDate, "yyyy-mm-dd") & " do " & Format(maxDate, "yyyy-mm-dd") & vbCrLf & vbCrLf & _
           "Baza 'Labor Actuals DB' oraz 'Executive Dashboard' zostały zaktualizowane.", vbInformation, "TPLH Forecast — Sukces"
    Exit Sub

ErrorHandler:
    On Error Resume Next
    If Not srcWb Is Nothing Then srcWb.Close SaveChanges:=False
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    Application.Calculation = xlCalculationAutomatic
    MsgBox "Wystąpił nieoczekiwany błąd podczas importu: " & Err.Description, vbCritical, "Błąd procedury"
CleanExit:
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    Application.Calculation = xlCalculationAutomatic
End Sub

' ------------------------------------------------------------------------------
' 2. NAWIGACJA: POKAŻ / EDYTUJ BAZĘ AOP
' ------------------------------------------------------------------------------
Public Sub PrzelaczArkuszAOP()
    On Error Resume Next
    Application.ScreenUpdating = False
    With ThisWorkbook.Sheets("AOP Plan Master")
        .Visible = xlSheetVisible
        .Activate
    End With
    Application.ScreenUpdating = True
End Sub

' ------------------------------------------------------------------------------
' 3. NAWIGACJA: POKAŻ BAZĘ LOGOWAŃ (RCP DB)
' ------------------------------------------------------------------------------
Public Sub PrzelaczArkuszLaborDB()
    On Error Resume Next
    Application.ScreenUpdating = False
    With ThisWorkbook.Sheets("Labor Actuals DB")
        .Visible = xlSheetVisible
        .Activate
    End With
    Application.ScreenUpdating = True
End Sub

' ------------------------------------------------------------------------------
' 4. NAWIGACJA: POKAŻ FLOOR HOURS ENGINE
' ------------------------------------------------------------------------------
Public Sub PrzelaczArkuszFloor()
    On Error Resume Next
    Application.ScreenUpdating = False
    With ThisWorkbook.Sheets("Floor Hours Engine")
        .Visible = xlSheetVisible
        .Activate
    End With
    Application.ScreenUpdating = True
End Sub

' ------------------------------------------------------------------------------
' 5. POWRÓT DO EXECUTIVE DASHBOARD (UKRYWA POZOSTAŁE ARKUSZE)
' ------------------------------------------------------------------------------
Public Sub WrocDoDashboardu()
    On Error Resume Next
    Application.ScreenUpdating = False
    UkryjWszystkieSilniki
    With ThisWorkbook.Sheets("Executive Dashboard")
        .Visible = xlSheetVisible
        .Activate
    End With
    Application.ScreenUpdating = True
End Sub

' ------------------------------------------------------------------------------
' 6. TRYB JEDNOARKUSZOWY / KIOSKOWY: UKRYJ WSZYSTKIE ARKUSZE POZA DASHBOARDEM
' ------------------------------------------------------------------------------
Public Sub UkryjWszystkieSilniki()
    Dim ws As Worksheet
    On Error Resume Next
    Application.ScreenUpdating = False
    
    ThisWorkbook.Sheets("Executive Dashboard").Visible = xlSheetVisible
    
    For Each ws In ThisWorkbook.Worksheets
        If ws.Name <> "Executive Dashboard" Then
            ws.Visible = xlSheetHidden
        End If
    Next ws
    
    ThisWorkbook.Sheets("Executive Dashboard").Activate
    Application.ScreenUpdating = True
End Sub

' ------------------------------------------------------------------------------
' 7. AUTOMATYCZNE UKRYCIE PRZY OTWARCIU SKOROSZYTU
' ------------------------------------------------------------------------------
Public Sub Auto_Open()
    UkryjWszystkieSilniki
End Sub
