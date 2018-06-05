var util = require("./sis-util");
var settings = require("./sis-settings");
var constants = require("./sis-constants");
var requestPromise = require("request-promise");
var users = new Set();

console.log("SIS job started on " + new Date());

util.loadCsv({
	inputFolder: "data",
	inputFile: "grades.txt",
	outputFolder: "data",
	outputFiles: ["users.txt"],
	validateHeader: function (data) {
		return data.COURSE_ID && data.COLUMN_ID && data.USER_ID && data.GRADE;
	},
	validateData: function (data) {
		return data.COURSE_ID.length > 0 && data.COLUMN_ID.length > 0 && data.USER_ID.length > 0 && data.GRADE.length > 0;
	},
	headerValidated: function (outputs) {
		outputs[0].write(constants.userHeader.join(settings.fieldDelimiter) + '\n');
	},
	transformData: function (data) {
		data.USER_ID = data.USER_ID.toLowerCase();
	},
	processData: function (data, outputs) {
		if (!users.has(data.USER_ID)) {
			outputs[0].write([data.USER_ID, data.USER_ID, "Testing", "User", "STAFF", "Y", "enabled"].join(settings.fieldDelimiter) + '\n');
			users.add(data.USER_ID);
		}
	},
	complete: function (success, streams) {
		if (success) {
			requestPromise.post(util.getRequestOptions('/person/store', streams[0]))
				.then(function (body) {
					util.handleReferenceCode(
						body,
						(code) => util.pollStatus(util.getRequestOptions('/dataSetStatus/' + code), 1, () => console.log("SIS job completed on " + new Date()))
					);
				}).catch(error => util.error("Error code from Bb server " + error.statusCode));
		} else {
			console.log("SIS job completed with fatal error on " + new Date());
		}
	}
});