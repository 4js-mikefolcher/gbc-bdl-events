#+ Test program for the bdlEvents front call: startup only. "MainController.42m child" runs it
#+ as a second program of the same GBC session.
IMPORT FGL BdlEventsTestController

MAIN
   CALL ui.Interface.loadStyles("BdlEventsTest")
   CALL BdlEventsTestController.run(arg_val(1) = "child")
END MAIN
