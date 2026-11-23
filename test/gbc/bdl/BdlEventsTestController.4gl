#+ Emits bdlEvents events in each way a program can, for the GBC probe widget to record. Every
#+ front call result (status and err_get) is shown in the errorStatus and errorText fields.

#+ The data of the "probe" and "command" events: one member of each kind of type.
PRIVATE TYPE tProbe RECORD
   step   STRING,
   count  INTEGER,
   amount DECIMAL(10,2),
   day    DATE,
   flag   BOOLEAN,
   tags   DYNAMIC ARRAY OF STRING
END RECORD

PUBLIC FUNCTION run(isChild BOOLEAN) RETURNS ()
   VAR probe tProbe
   VAR tags DYNAMIC ARRAY OF STRING
   VAR nullName STRING
   VAR errorStatus INTEGER
   VAR errorText STRING

   # A state emitted before the window exists: the probe gets it when it subscribes (replay)
   LET probe.step = IIF(isChild, "childBeforeWindow", "beforeWindow")
   CALL emitProbe("probe", probe) RETURNING errorStatus, errorText

   OPEN WINDOW wBdlEventsTest WITH FORM "BdlEventsTest"
      ATTRIBUTES(TEXT = IIF(isChild, "Child program", "Parent program"))
   # Emitted with the window in the same AUI update: the new probe must receive it
   LET probe.step = IIF(isChild, "childSameOrder", "sameOrder")
   CALL emitProbe("probe", probe) RETURNING errorStatus, errorText
   CALL showResult(errorStatus, errorText)

   LET int_flag = FALSE
   MENU
      ON ACTION emitrecord ATTRIBUTES(TEXT = "Emit record")
         LET probe.step = "record"
         LET probe.count = 42
         LET probe.amount = 1234.56
         LET probe.day = MDY(11, 23, 2026)
         LET probe.flag = TRUE
         LET probe.tags[1] = "red"
         LET probe.tags[2] = "green"
         CALL emitProbe("command", probe) RETURNING errorStatus, errorText
         CALL showResult(errorStatus, errorText)

      ON ACTION emitarray ATTRIBUTES(TEXT = "Emit array")
         LET tags[1] = "one"
         LET tags[2] = "two"
         TRY
            CALL ui.Interface.frontCall("bdlEvents", "emit", ["command", tags], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emitstring ATTRIBUTES(TEXT = "Emit string")
         TRY
            CALL ui.Interface.frontCall("bdlEvents", "emit", ["command", "Hello"], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emitnodata ATTRIBUTES(TEXT = "Emit no data")
         TRY
            CALL ui.Interface.frontCall("bdlEvents", "emit", ["command"], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emituppercase ATTRIBUTES(TEXT = "Emit upper case")
         TRY
            CALL ui.Interface.frontCall("BDLEVENTS", "EMIT", ["command", "upper"], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emitnullname ATTRIBUTES(TEXT = "Emit NULL name")
         TRY
            CALL ui.Interface.frontCall("bdlEvents", "emit", [nullName, "x"], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emitnoparameters ATTRIBUTES(TEXT = "Emit no parameters")
         TRY
            CALL ui.Interface.frontCall("bdlEvents", "emit", [], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emittoomany ATTRIBUTES(TEXT = "Emit too many")
         TRY
            CALL ui.Interface.frontCall("bdlEvents", "emit", ["command", 1, 2], [])
            CALL showResult(0, NULL)
         CATCH
            CALL showResult(status, err_get(status))
         END TRY

      ON ACTION emitthensleep ATTRIBUTES(TEXT = "Emit then sleep")
         LET probe.step = "beforeSleep"
         CALL emitProbe("command", probe) RETURNING errorStatus, errorText
         SLEEP 3
         CALL showResult(errorStatus, "slept")

      ON ACTION child ATTRIBUTES(TEXT = "Start child")
         RUN SFMT('"%1/bin/fglrun" MainController.42m child', fgl_getenv("FGLDIR")) WITHOUT WAITING

      ON ACTION quit ATTRIBUTES(TEXT = "Quit")
         EXIT MENU

      ON ACTION close
         EXIT MENU
   END MENU
   CLOSE WINDOW wBdlEventsTest
END FUNCTION

#+ Emits one event with a tProbe record as its data.
PRIVATE FUNCTION emitProbe(eventName STRING, probe tProbe) RETURNS (INTEGER, STRING)
   VAR errorStatus INTEGER
   VAR errorText STRING
   TRY
      CALL ui.Interface.frontCall("bdlEvents", "emit", [eventName, probe], [])
   CATCH
      LET errorStatus = status
      LET errorText = err_get(status)
   END TRY
   RETURN errorStatus, errorText
END FUNCTION

PRIVATE FUNCTION showResult(errorStatus INTEGER, errorText STRING) RETURNS ()
   DISPLAY errorStatus TO errorStatus
   DISPLAY errorText TO errorText
END FUNCTION
