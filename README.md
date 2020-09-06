<p align="center">

  <h3 align="center">Google Drive Access Reporter</h3>

  <p align="center">
    AppScript code + email template to run a full audit of all files your Google account has access to in Google Drive. Results are written to a [Google Sheets](https://sheets.google.com), which can then be analyzed or visualized in [Google Data Studio](https://datastudio.google.com)
  </p>
</p>


## Why

I wanted to create a method for users to audit their own Google Drive footprint, without having to give access to a 3rd party application/service.

## Built With
This is a native AppScript solution...just a little appscript and HTML for the code...then using the built-in triggers to run on a schedule (for large accounts)
* [AppScript](https://script.google.com)

## Getting Started

* Copy the raw code from the Code.gs and email.html files to your appscript project
* Keep the file names the same
* Update the variables inside the Code.gs file to point to your results sheet, tab names, and notification email (does not have to be the same as the acct being scanned)
* Run the set_sheet_headers() function, which will prompt for permissions
* Accept the permissions (asking for access for your script to read/write to google drive). It should only require access to Google Drive (to perform the audit) and Gmail (to send the final notification email)
* Run the lookup_all_google_drive_files_using_continuation_tokens() function (once, or set a trigger)
* Look in your google sheet as the function is running, and you should see results being inserted 


<!-- FUTURE -->
## Future
* At some point i'll want to figure out how to scale this to multiple accounts, so someone like a G Suite Admin could run it on their users.
* Scaling potentially using Google Cloud Functions instead of AppScript might be considered too
* Need to figure out if there's an efficient way to run this more rapidly on large accounts (though not sure based on how the FileIterator works)

<!-- CONTACT -->
## Contact

Nick Young - [@techupover](https://twitter.com/techupover) - usaussie@gmail.com

Project Link: [https://github.com/usaussie/google_drive_access_reporter](https://github.com/usaussie/google_drive_access_reporter)
