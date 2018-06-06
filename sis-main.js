var util = require("./sis-util");
var settings = require("./sis-settings");
var constants = require("./sis-constants");
var requestPromise = require("request-promise");
var users = new Set(), courses = new Set(), lastUsers = new Set(), lastCourses = new Set();

// TODO: BGM, Housekeep files
console.log("SIS job started on " + new Date());

util.loadCsv({
	inputFolder: "data-last",
	inputFile: "grades.txt",
	validateData: data => data.COURSE_ID.length > 0 && data.COLUMN_ID.length > 0 && data.USER_ID.length > 0 && data.GRADE.length > 0,
	processData: data => {
		lastUsers.add(data.USER_ID.toLowerCase());
		lastCourses.add(data.COURSE_ID.toLowerCase());
	},
	summary: count => console.log(count + " data row(s) loaded"),
	success: () => {
		console.log("Last data file loaded with " + lastUsers.size + " user(s) and " + lastCourses.size + " course(s)");
		util.loadCsv({
			inputFolder: "data-in",
			inputFile: "grades.txt",
			outputFolder: "data-out",
			outputFiles: ["users-update.txt", "courses-update.txt", "users-remove.txt", "courses-remove.txt"],
			housekeepFolder: "data-last",
			validateHeader: data => data.COURSE_ID && data.COLUMN_ID && data.USER_ID && data.GRADE,
			validateData: data => data.COURSE_ID.length > 0 && data.COLUMN_ID.length > 0 && data.USER_ID.length > 0 && data.GRADE.length > 0,
			headerValidated: outputs => {
				outputs[0].write(constants.userUpdateHeader.join(settings.fieldDelimiter) + '\n');
				outputs[1].write(constants.courseUpdateHeader.join(settings.fieldDelimiter) + '\n');
				outputs[2].write(constants.userRemoveHeader.join(settings.fieldDelimiter) + '\n');
				outputs[3].write(constants.courseRemoveHeader.join(settings.fieldDelimiter) + '\n');
			},
			transformData: data => [data.USER_ID, data.COURSE_ID].forEach(value => value.toLowerCase()),
			processData: (data, outputs) => {
				if (!users.has(data.USER_ID)) {
					outputs[0].write([data.USER_ID, data.USER_ID, "Testing", "User", "STAFF", "Y", "enabled"].join(settings.fieldDelimiter) + '\n');
					users.add(data.USER_ID);
					lastUsers.delete(data.USER_ID);
				}
				if (!courses.has(data.COURSE_ID)) {
					outputs[1].write([data.COURSE_ID, data.COURSE_ID, "Test Course", "Y", "enabled"].join(settings.fieldDelimiter) + '\n');
					courses.add(data.COURSE_ID);
					lastCourses.delete(data.COURSE_ID);
				}
			},
			flushFiles: outputs => {
				lastUsers.forEach(user => outputs[2].write([user, user].join(settings.fieldDelimiter) + '\n'));
				lastCourses.forEach(course => outputs[3].write([course, course].join(settings.fieldDelimiter) + '\n'));
			},
			success: outputs => {
				util.uploadWithPolling('/person/store', outputs[0], () => {
					util.uploadWithPolling('/course/store', outputs[1], () => {
						util.uploadWithPolling('/person/delete', outputs[2], () => {
							util.uploadWithPolling('/course/delete', outputs[3], () => {
								console.log("SIS job completed on " + new Date());
							});
						});
					});
				});
			},
			error: () => console.log("SIS job completed with fatal error on " + new Date())
		});
	},
	error: function () {
		this.success();
	}
});