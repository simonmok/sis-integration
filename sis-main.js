var util = require("./sis-util");
var settings = require("./sis-settings");
var constants = require("./sis-constants");
var requestPromise = require("request-promise");
var users = new Set(), courses = new Set();

console.log("SIS job started on " + new Date());

util.loadCsv({
	inputFolder: "data-in",
	inputFile: "grades.txt",
	outputFolder: "data-out",
	outputFiles: ["users.txt", "courses.txt"],
	validateHeader: data => data.COURSE_ID && data.COLUMN_ID && data.USER_ID && data.GRADE,
	validateData: data => data.COURSE_ID.length > 0 && data.COLUMN_ID.length > 0 && data.USER_ID.length > 0 && data.GRADE.length > 0,
	headerValidated: outputs => {
		outputs[0].write(constants.userHeader.join(settings.fieldDelimiter) + '\n');
		outputs[1].write(constants.courseHeader.join(settings.fieldDelimiter) + '\n');
	},
	transformData: data => {
		data.USER_ID = data.USER_ID.toLowerCase();
	},
	processData: (data, outputs) => {
		if (!users.has(data.USER_ID)) {
			outputs[0].write([data.USER_ID, data.USER_ID, "Testing", "User", "STAFF", "Y", "enabled"].join(settings.fieldDelimiter) + '\n');
			users.add(data.USER_ID);
		}
		if (!courses.has(data.COURSE_ID)) {
			outputs[1].write([data.COURSE_ID, data.COURSE_ID, "Test Course", "Y", "enabled"].join(settings.fieldDelimiter) + '\n');
			courses.add(data.COURSE_ID);
		}
	},
	complete: (success, streams) => {
		if (success) {
			console.log('Sending the person file to SIS');
			util.uploadWithPolling('/person/store', streams[0], () => {
				console.log('Sending the course file to SIS');
				util.uploadWithPolling('/course/store', streams[1], () => console.log("SIS job completed on " + new Date()));
			});
		} else {
			console.log("SIS job completed with fatal error on " + new Date());
		}
	}
});