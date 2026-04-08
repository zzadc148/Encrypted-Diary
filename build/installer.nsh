!macro customInit
  ${StdUtils.GetParameter} $R0 "D" ""
  ${If} $R0 == ""
    StrCpy $INSTDIR "$EXEDIR\${APP_FILENAME}"
  ${EndIf}
!macroend
