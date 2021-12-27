/*************************************************
*
* GOOGLE DRIVE CONTENT ACCESS AUDIT
* Author: Nick Young
* Email: usaussie@gmail.com
*
* Instructions: 
* (1) Update the variables below to point to your results sheet
* (2) Run the job_set_sheet_headers() function, which will prompt for permissions
* (3) Accept the permissions (asking for access for your script to read/write to google drive)
* (4) Run the job_lookup_all_google_drive_files_using_continuation_tokens() function (once, or set a trigger)
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
var NOTIFICATION_RECIPIENTS = "youremail@domain.com";
// Google Sheet URL that you have access to edit (should be blank to begin with)
var GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/this-sheet-id/edit";
// tab/sheet name to house the list of File IDs for everything in your Google Drive
var GOOGLE_SHEET_RESULTS_TAB_NAME = "Sheet1";
// change TIMEOUT VALUE
//var TIMEOUT_VALUE_MS = 270000; // 4.5 minutes
//var TIMEOUT_VALUE_MS = 210000; // 3.5 mins (so we can run this every 5 minutes)
var TIMEOUT_VALUE_MS = 210000; // 3.5 mins (so we can run this every 5 minutes)
//var TIMEOUT_VALUE_MS = 5000; // for testing only

//if doing CSV to BQ stuff
// folder ID for where to place CSV files to be processed/loaded into BQ
var NORMALIZED_CSV_DRIVE_FOLDER_ID = "1wPMrd8ufdshbfvadsfuUHq5y0c";

// where to put the raw files once they've been normalized
var LOADED_INTO_BQ_DRIVE_FOLDER_ID = "1WOw89yhufbasfasyuRJIi";

// BigQuery Project ID - all lowercase
// Create a project/dataset/table in the BigQuery UI (https://bigquery.cloud.google.com)
const BQ_PROJECT_ID = 'yourBQProjectID';
const BQ_DATASET_ID = 'yourBQDatasetID';
const BQ_TABLE_ID = 'drive_audit_data';  // change this if you want it called something different

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
function job_set_sheet_headers() {
  
  var results_sheet = SpreadsheetApp.openByUrl(GOOGLE_SHEET_URL).getSheetByName(GOOGLE_SHEET_RESULTS_TAB_NAME);
  results_sheet.appendRow(["AUDIT_DATE", "ID", "URL", "NAME", "TYPE", "SIZE_BYTES", "CREATED", "LAST_UPDATED", "OWNER", "SHARING_ACCESS", "SHARING_PERMISSION", "PERMISSION_TYPE", "PERMITTED_EMAIL_ADDRESS", "FOLDER_ID", "FOLDER_URL", "FOLDER_NAME"]);
  
}

/*
*
* run this when you want to clear the tokens so you can run the loop
*
*/
function job_delete_token_and_reset_run_history() {

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
function job_lookup_all_google_drive_files_using_continuation_tokens() {
  
  Logger.log('starting lookup'); 
  
  var scriptProperties = PropertiesService.getScriptProperties();
  
  var alreadyRun = scriptProperties.getProperty('alreadyRun');
  
  if(alreadyRun == "true") {
    Logger.log('already run: ' + alreadyRun); 
    return;
  } 
  
  var start = new Date();
  var audit_timestamp = Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  
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
    var created_formatted_time = Utilities.formatDate(created, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
    var lastupdated = thisFile.getLastUpdated();
    var lastupdated_formatted_time = Utilities.formatDate(lastupdated, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
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
    var newRow = [audit_timestamp, id, url, name, type, size, created_formatted_time, lastupdated_formatted_time, ownerEmail, sharingaccess, sharingpermissions, 'OWNER', ownerEmail, folderId, folderUrl, folderName];
    
    //ss.appendRow(newRow);
    
    // add to row array instead of append because append is SLOOOOOWWWWW
    rowsToWrite.push(newRow);
    
    
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
  var filledPermissionRows = fillOutRange_(rowsToWrite, 'NULL');  
  //ss.getRange(ss.getLastRow() + 1, 1, filledPermissionRows.length, filledPermissionRows[0].length).setValues(filledPermissionRows);
  ss.getRange(ss.getLastRow() + 1, 1, rowsToWrite.length, rowsToWrite[0].length).setValues(rowsToWrite);

  // CSV. & BQ stuff
  Logger.log('Creating CSV'); 
  var normalizedCSVata = normalize_csv_data_(rowsToWrite);
  var this_time = new Date().getTime();
  var new_file_name = "DRIVE_ACCESS_REPORTER____" + this_time + ".csv";
  var new_file = DriveApp.createFile(new_file_name, normalizedCSVata);
  var ready_to_load_folder = DriveApp.getFolderById(NORMALIZED_CSV_DRIVE_FOLDER_ID);
  new_file.moveTo(ready_to_load_folder);
  Logger.log('Created CSV: ' + new_file_name); 
  
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

function fillOutRange_(range, fillItem){
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



// CSV writing stuff

function normalize_csv_data_(csvArrayData) {

  var returnArray = []

  for (i = 0; i < csvArrayData.length; i++) {

    // make sure there is data in this row, if not, go to next line
    if(csvArrayData[i][0] == '' || csvArrayData[i][0] == null) {
      continue;
    }

    var thisArray = [
      csvArrayData[i][0], // audit_date
      csvArrayData[i][1], // id
      csvArrayData[i][2], // url
      csvArrayData[i][3], // name
      csvArrayData[i][4], // type
      csvArrayData[i][5], // size_bytes
      csvArrayData[i][6], // created
      csvArrayData[i][7], // last_updated
      csvArrayData[i][8], // owner
      csvArrayData[i][9], // sharing_access
      csvArrayData[i][10], // sharing_permission
      csvArrayData[i][11], // permission_type
      csvArrayData[i][12], // permitted_email_address
      csvArrayData[i][13], // folder_id
      csvArrayData[i][14], // folder_url
      csvArrayData[i][15], // folder_name
     ];

     //Logger.log('CSV Array Data: ' + csvArrayData[i]);

     //Logger.log(thisArray)

     returnArray.push(thisArray);

  }

  var csv = new csvWriter_();
  var csvFile = csv.arrayToCSV(returnArray)

  return csvFile;
  
}

/**
 * Class for creating csv strings
 * Handles multiple data types
 * Objects are cast to Strings
 * Source: https://stackoverflow.com/questions/201724/easy-way-to-turn-javascript-array-into-comma-separated-list
 **/

function csvWriter_(del, enc) {
	this.del = del || ','; // CSV Delimiter
	this.enc = enc || '"'; // CSV Enclosure
	
	// Convert Object to CSV column
	this.escapeCol = function (col) {
		if(isNaN(col)) {
			// is not boolean or numeric
			if (!col) {
				// is null or undefined
				col = '';
			} else {
				// is string or object
				col = String(col);
				if (col.length > 0) {
					// use regex to test for del, enc, \r or \n
					// if(new RegExp( '[' + this.del + this.enc + '\r\n]' ).test(col)) {
					
					// escape inline enclosure
					col = col.split( this.enc ).join( this.enc + this.enc );
				
					// wrap with enclosure
					col = this.enc + col + this.enc;
				}
			}
		}
		return col;
	};
	
	// Convert an Array of columns into an escaped CSV row
	this.arrayToRow = function (arr) {
		var arr2 = arr.slice(0);
		
		var i, ii = arr2.length;
		for(i = 0; i < ii; i++) {
			arr2[i] = this.escapeCol(arr2[i]);
		}
		return arr2.join(this.del);
	};
	
	// Convert a two-dimensional Array into an escaped multi-row CSV 
	this.arrayToCSV = function (arr) {
		var arr2 = arr.slice(0);
		
		var i, ii = arr2.length;
		for(i = 0; i < ii; i++) {
			arr2[i] = this.arrayToRow(arr2[i]);
		}
		return arr2.join("\r\n");
	};
}

function job_load_csv_to_bq() {

  var files = get_pending_csv_files_(NORMALIZED_CSV_DRIVE_FOLDER_ID);
  
  // loop through the files and load them
  while (files.hasNext()){
    var file = files.next();

    var this_file_id = file.getId();
    var this_file_name = file.getName();

    // submit BQ load job and log either side with details
    Logger.log('Starting Load Job. File Name: ' + this_file_name);
    // extract values from row of data for easier reference below
    var source_format = 'CSV';
    var write_disposition = 'WRITE_APPEND';
    var skip_leading_rows = 0;
    var this_job = bq_load_csv_(BQ_PROJECT_ID, BQ_DATASET_ID, BQ_TABLE_ID, this_file_id, skip_leading_rows, source_format, write_disposition);
    Logger.log('BigQuery Load Job Started for: ' + BQ_PROJECT_ID + ':' + BQ_DATASET_ID + ':' + BQ_TABLE_ID);
    Logger.log('View Status: https://console.cloud.google.com/bigquery?page=jobs&project='+ BQ_PROJECT_ID);

    Logger.log('Submitted Load Job: File Name: ' + this_file_name);

    // move file to processed folder
    var processed_folder = DriveApp.getFolderById(LOADED_INTO_BQ_DRIVE_FOLDER_ID);
    file.moveTo(processed_folder);

    Logger.log('Ending Load Job. File Name: ' + this_file_name);

  }

}

/**
 * Only run this once to create the intitial tables to hold the CSV data.
 */

function job_create_bq_table_one_time() {

    var thisTable;
    thisTable = {};
    thisTable.tableId = BQ_TABLE_ID;
    thisTable.schema = {
        fields: [
          {name: 'AUDIT_DATE', type: 'TIMESTAMP'},
          {name: 'ID', type: 'STRING'},
          {name: 'URL', type: 'STRING'},
          {name: 'NAME', type: 'STRING'},
          {name: 'TYPE', type: 'STRING'},
          {name: 'SIZE_BYTES', type: 'FLOAT'},
          {name: 'CREATED', type: 'TIMESTAMP'},
          {name: 'LAST_UPDATED', type: 'TIMESTAMP'},
          {name: 'OWNER', type: 'STRING'},
          {name: 'SHARING_ACCESS', type: 'STRING'},
          {name: 'SHARING_PERMISSION', type: 'STRING'},
          {name: 'PERMISSION_TYPE', type: 'STRING'},
          {name: 'PERMITTED_EMAIL_ADDRESS', type: 'STRING'},
          {name: 'FOLDER_ID', type: 'STRING'},
          {name: 'FOLDER_URL', type: 'STRING'},
          {name: 'FOLDER_NAME', type: 'STRING'}
        ]
      };

    var tableJson = constructTableJson_(thisTable, BQ_PROJECT_ID, BQ_DATASET_ID);
    bq_createTable_(BQ_TABLE_ID, BQ_PROJECT_ID, BQ_DATASET_ID, tableJson);
  
}

function constructTableJson_(thisTableData, thisProjectId, thisDatasetId) {

  return{
      tableReference: {
        projectId: thisProjectId,
        datasetId: thisDatasetId,
        tableId: thisTableData.tableId
      },
      schema: thisTableData.schema
    };

}

/**
 * Create Tables
 */
function bq_createTable_(thisTableId, thisProjectId, thisDataSetId, tableReferenceJson) {

  table = BigQuery.Tables.insert(tableReferenceJson, thisProjectId, thisDataSetId);
  Logger.log('Table created: %s', thisTableId);

}

/**
 * Load a CSV into BigQuery
 */
function bq_load_csv_(project_id, dataset_id, table_id, csv_file_id, skip_leading_rows, source_format, write_disposition) {
  
  // Load CSV data from Drive and convert to the correct format for upload.
  var file = DriveApp.getFileById(csv_file_id);
  var data = file.getBlob().setContentType('application/octet-stream');

  // Create the data upload job.
  var my_job = {
    configuration: {
      load: {
        destinationTable: {
          projectId: project_id,
          datasetId: dataset_id,
          tableId: table_id
        },
        skipLeadingRows: skip_leading_rows,
        sourceFormat: source_format,
        writeDisposition: write_disposition,
      }
    }
  };
  
  return load_job = BigQuery.Jobs.insert(my_job, project_id, data);
  
}

/**
 * 
 * Run this to process all the CSV files in the pending director.
 * 
*/

function get_pending_csv_files_(source_drive_folder_id) {
  var folder = DriveApp.getFolderById(source_drive_folder_id);
  var files = folder.getFiles();
  
  return files;

}
