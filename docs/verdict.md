# Verdict for organizers

An event can ask for the result of the check and not for the recording or the deck. After a combined check the results page offers two files.

- **The verdict** goes to the organizer. It holds both scores, the level and the reason for each criterion, the two-sentence summary of what the team builds, how much of the deck the talk covers, and the setup that produced it (model, dtype, and a hash over the service's code, which contains every prompt, rubric and limit). It does not hold the feedback, the timeline, the slide notes or the files.
- **The proof** stays with the team. It holds two random salts.

For each file the verdict carries SHA-256(salt + file). The salt is random per analysis and is made by the service, so the fingerprint says nothing about the file, and the same deck gives a different fingerprint every time. When the organizer asks a finalist to show the recording and the deck, the team hands over the proof with them, and `/verify` checks in the browser that these are the files the verdict was made for and that the verdict came from the same setup as the organizer's installation. The organizer can then run the files through the main page and compare the scores.

What this does and does not give:

- It makes a swapped file or a verdict for another file show up at the check. It does not stop a team from editing a verdict; an edited score shows up only when the organizer re-runs the analysis.
- Scores from a re-run are expected to be close, not always identical: the same model can give different levels on different hardware or dtype. How wide that band is on real hardware has not been measured.
- It does not show which of several attempts a team handed in.
- The verdict is not anonymous: the summary says what the team builds.

None of this is cryptographic proof of an honest analysis, and the app does not call it that.
