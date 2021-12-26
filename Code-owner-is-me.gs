/*************************************************
*
* GOOGLE DRIVE CONTENT ACCESS AUDIT
* Author: Nick Young
* Email: usaussie@gmail.com
*
* Instructions: 
* (1) Update the variables below to point to your results sheet
* (2) Run the set_sheet_headers() function, which will prompt for permissions
* (3) Accept the permissions (asking for access for your script to read/write to google drive)
* (4) Run the lookup_all_google_drive_files_using_continuation_tokens() function (once, or set a trigger)
* (5) Look in your google sheet as the function is running, and you should see results being inserted
*
* Extra Info: 
* (1) Inserts "NULL" for applicable field values where owner cannot be determined (shared drives & gmail/chat attachments)
*
************************************************/

/*************************************************
*
* UPDATE THESE VARIABLES
*
*************************************************/
// Comma-separated Email addresses of owner and any additional recipients for notification when the audit completes
var NOTIFICATION_RECIPIENTS = "myemail@domain.com";
// Google Sheet URL that you have access to edit (should be blank to begin with)
var GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/my-google-sheet-id/edit";
// tab/sheet name to house the list of File IDs for everything in your Google Drive
var GOOGLE_SHEET_RESULTS_TAB_NAME = "Sheet1";
// change TIMEOUT VALUE
//var TIMEOUT_VALUE_MS = 270000; // 4.5 minutes
//var TIMEOUT_VALUE_MS = 210000; // 3.5 mins (so we can run this every 5 minutes)
var TIMEOUT_VALUE_MS = 210000; // 3.5 mins (so we can run this every 5 minutes)


/*
************************************************
*
* DO NOT CHANGE ANYTHING UNDER THIS LINE 
*
************************************************
*/

/*
*
* ONLY RUN THIS ONCE TO SET THE HEADER ROWS FOR THE GOOGLE SHEETS
* Later should probably have some logic to look up to see if the first row is set, then run this automatically (or not)
*
*/
function set_sheet_headers() {
  
  var results_sheet = SpreadsheetApp.openByUrl(GOOGLE_SHEET_URL).getSheetByName(GOOGLE_SHEET_RESULTS_TAB_NAME);
  results_sheet.appendRow(["AUDIT_DATE", "ID", "URL", "NAME", "TYPE", "SIZE_BYTES", "CREATED", "LAST_UPDATED", "OWNER", "SHARING_ACCESS", "SHARING_PERMISSION", "PERMISSION_TYPE", "PERMITTED_EMAIL_ADDRESS", "FOLDER_ID", "FOLDER_URL", "FOLDER_NAME"]);
  
}

/*
*
* run this when you want to clear the tokens so you can run the loop
*
*/
function delete_token_and_reset_run_history() {

  var scriptProperties = PropertiesService.getScriptProperties();
  
  PropertiesService.getScriptProperties().deleteProperty('continuationToken'); 
  scriptProperties.setProperty('alreadyRun', 'false');
}


/*
*
* big function, that should probably be split into multiple smaller things
* This is the one to run on a schedule (or ad-hoc) and takes care of everything.
*
*/
function lookup_all_google_drive_files_using_continuation_tokens() {
  
  Logger.log('starting lookup'); 
  
  var scriptProperties = PropertiesService.getScriptProperties();
  
  var alreadyRun = scriptProperties.getProperty('alreadyRun');
  
  if(alreadyRun == "true") {
    Logger.log('already run: ' + alreadyRun); 
    return;
  } 
  
  var start = new Date();
  
  var continuationToken,files,filesFromToken,fileIterator,thisFile;//Declare variable names
  
  arrayAllFileNames = [];//Create an empty array and assign it to this variable name
  
  existingToken = scriptProperties.getProperty('continuationToken');
  
  Logger.log(existingToken);
  
  if(existingToken == null) {
    //files = DriveApp.getFiles(); //Get all files from Google Drive in this account
    //continuationToken = files.getContinuationToken();//Get the continuation token
    //Logger.log("Continuation Token: " + continuationToken);

    // Use the searchFiles() method and use the equivalent search of "owner:me" to only find files owned by the person running this script
    var files = DriveApp.searchFiles('"me" in owners');
    continuationToken = files.getContinuationToken();//Get the continuation token
    Logger.log("Token (Continuation): " + continuationToken);

  } else {
    continuationToken = existingToken; //Get the continuation token that was already stored
    Logger.log("Token (Existing): " + continuationToken);
    
  }
  
  scriptProperties.setProperty('continuationToken', continuationToken);
  
  //Utilities.sleep(1);//Pause the code for 1ms seconds
  
  filesFromToken = DriveApp.continueFileIterator(scriptProperties.getProperty('continuationToken'));//Get the original files stored in the token
  files = null;//Delete the files that were stored in the original variable, to prove that the continuation token is working
  
  var newRow = [];
  var rowsToWrite = [];
  
  var ss = SpreadsheetApp.openByUrl(GOOGLE_SHEET_URL).getSheetByName(GOOGLE_SHEET_RESULTS_TAB_NAME);
  
  while (filesFromToken.hasNext()) {//If there is a next file, then continue looping
    
    if (isTimeUp_(start)) {
      Logger.log("Time up");
      break;
    }
    
    thisFile = filesFromToken.next();//Get the next file
    //arrayAllFileNames.push(thisFile.getName());//Get the name of the next file
    
    //Logger.log(JSON.stringify(thisFile));

    var owner = thisFile.getOwner();
    var id = thisFile.getId();
    var created = thisFile.getDateCreated();
    var lastupdated = thisFile.getLastUpdated();
    var name = thisFile.getName();
    var url = thisFile.getUrl();
    var type = thisFile.getMimeType();
    var size = thisFile.getSize();
    var parents = thisFile.getParents();
    
    // write folder(s) to sheet if available
    while (parents.hasNext()) {
      var folder = parents.next();
      var folderId = folder.getId();
      var folderUrl = folder.getUrl();
      var folderName = folder.getName();
    }
    
    try {
      var ownerEmail = owner.getEmail();
    } catch (e) {
      var ownerEmail = 'NULL';
      Logger.log('Error owner.getEmail() | URL: ' + url + ' | CAUGHT EXCEPTION:' + e);
    }

    try {
       var sharingaccess = thisFile.getSharingAccess();
       var sharingpermissions = thisFile.getSharingPermission();
    } catch (e) {
      // Logs an ERROR message.
      Logger.log('Error getSharingAccess() or getSharingPermission() | URL: ' + url + ' | CAUGHT EXCEPTION:' + e);
      var sharingaccess = 'NOT_AVAILABLE';
      var sharingpermissions = 'NOT_AVAILABLE';
    }
    
    //write initial file info to sheet
    var newRow = [new Date(), id, url, name, type, size, created, lastupdated, ownerEmail, sharingaccess, sharingpermissions, 'OWNER', ownerEmail, folderId, folderUrl, folderName];
    
    //ss.appendRow(newRow);
    
    // add to row array instead of append because append is SLOOOOOWWWWW
    rowsToWrite.push(newRow);
    
    // write editor(s) to sheet if available
    var editors = thisFile.getEditors();
    for (var i = 0; i < editors.length; i++) {
      
      var newEditorRow = [new Date(), id, url, name, type, size, created, lastupdated, ownerEmail, sharingaccess, sharingpermissions, 'EDITOR', editors[i].getEmail(), folderId, folderUrl, folderName];
      //ss.appendRow(newFolderRow);
      rowsToWrite.push(newEditorRow);
    }
    
    // write viewer(s) to sheet if available
    var viewers = thisFile.getViewers();
    for (var i = 0; i < viewers.length; i++) {
      var newViewerRow = [new Date(), id, url, name, type, size, created, lastupdated, ownerEmail, sharingaccess, sharingpermissions, 'VIEWER', viewers[i].getEmail(), folderId, folderUrl, folderName];
      //ss.appendRow(newViewerRow);
      rowsToWrite.push(newViewerRow);
    }
    
    
    // Save our place by setting the token in our script properties
    // this is the magic that allows us to set this to run every minute/hour depending on the timeout value
    if(filesFromToken.hasNext()){
      var continuationToken = filesFromToken.getContinuationToken();
      scriptProperties.setProperty('continuationToken', continuationToken);
    } else {
      // Delete the token and store that we are complete
      PropertiesService.getScriptProperties().deleteProperty('continuationToken');
      scriptProperties.setProperty('alreadyRun', "true");
    }
    
  };
  
  //Logger.log('rowsToWrite: ' + rowsToWrite); 
  //Logger.log('folderRowsToWrite: ' + folderRowsToWrite); 
  
  // write collected rows arrays to the sheet in one operation (quicker than individual appends)
  var filledPermissionRows = fillOutRange(rowsToWrite, 'NULL');  
  //ss.getRange(ss.getLastRow() + 1, 1, filledPermissionRows.length, filledPermissionRows[0].length).setValues(filledPermissionRows);
  ss.getRange(ss.getLastRow() + 1, 1, rowsToWrite.length, rowsToWrite[0].length).setValues(rowsToWrite);
  
  if(!filesFromToken.hasNext()) {
   
    var templ = HtmlService
      .createTemplateFromFile('email');
  
    templ.sheetUrl = GOOGLE_SHEET_URL;
    
    var message = templ.evaluate().getContent();
    
    MailApp.sendEmail({
      to: NOTIFICATION_RECIPIENTS,
      subject: 'Google Drive Access Audit Complete',
      htmlBody: message
    });
    
  }
  
};

/*
* quick function to see if the timeout value has been reached (therefore stop the loop)
*/
function isTimeUp_(start) {
  var now = new Date();
  return now.getTime() - start.getTime() > TIMEOUT_VALUE_MS; // milliseconds
}

/********************************************* 
 * Fills each row array to the right with selected value 
 * to match the largest row in the dataset. 
 * 
 * @param {array} range: 2d array of data 
 * @para, {string} fillItem: (optional) String containg the value you want 
 *                            to add to fill out your array.  
 * @returns 2d array with all rows of equal length.
 * 
 * This handles the "Exception: The number of columns in the data does not match the number of columns in the range." problem
 */

function fillOutRange(range, fillItem){
  var fill = (fillItem === undefined)? "" : fillItem;
  
  //Get the max row length out of all rows in range.
  var initialValue = 0;
  var maxRowLen = range.reduce(function(acc, cur) {
    return Math.max(acc, cur.length);
  }, initialValue);

  //Fill shorter rows to match max with selecte value.
  var filled = range.map(function(row){
    var dif = maxRowLen - row.length;
    if(dif > 0){
      var arizzle = [];
      for(var i = 0; i <  dif; i++){arizzle[i] = fill};
      row = row.concat(arizzle);
    }    
    return row;
  })
  return filled;

};
