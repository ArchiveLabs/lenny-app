# Import page: manual browser test matrix

Automated tests (jest) cover the logic with fake entries and handles. Real drag-and-drop and file pickers
differ per browser and OS, so each cell below needs a person. **Status says what was actually run.**

For each cell, with a small nested folder (3 levels, 130+ EPUBs, one `.pdf`, one `.DS_Store`, one name
with an accent) and the same files dropped loose:

1. Drop the folder anywhere on the page: the overlay shows, rows appear, no error.
2. Use the folder picker (or "Choose files" where there is none).
3. Matching finishes; refresh the page: rows come back with "Drop the same folder again to reconnect N files".
4. Drop the parent folder, then a subfolder, then loose files: "Reconnected N of M files", banner clears.
5. Chromium desktop only: "Reconnect folder" after a refresh re-attaches in one click.
6. Import: books upload, closing the tab while matched books are waiting shows the browser warning.

| Browser / OS | Drop | Folder picker | Reconnect | Status |
|---|---|---|---|---|
| Chrome, macOS | ✔ files only | directory picker | Reconnect folder | Partly run: file drop on a harness page in Chromium 155. Nothing else. |
| Chrome, Windows | | directory picker | Reconnect folder | Not run |
| Chrome, Linux | | directory picker | Reconnect folder | Not run |
| Firefox, macOS | | webkitdirectory | drop again | Not run |
| Firefox, Windows | | webkitdirectory | drop again | Not run |
| Firefox, Linux | | webkitdirectory | drop again | Not run |
| Safari, macOS | | webkitdirectory | drop again | Not run |
| Safari, iOS | n/a | hidden; "Choose files" | drop again n/a: pick files again | Not run |
| Chrome, Android | n/a | hidden; "Choose files" | pick files again | Not run |
| Edge, Windows | | directory picker | Reconnect folder | Not run |

Things to look for: `.epub` accepted when the OS reports no file type (Windows, Android); accented names
(macOS stores them decomposed) reconnecting to rows created from another OS; a Linux file manager drag that
gives no folder entry.
