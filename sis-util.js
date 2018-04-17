module.exports = {

	loadCsv: function (SIS) {
		var fs = require("fs");
		var csv = require("fast-csv");
		var settings = require("./sis-settings");
		var stream = fs.createReadStream(SIS.file);
		var output = fs.createWriteStream(SIS.outputFile);
		var module = this;
		var count = 1, errorCount = 0, headerValid = false;
		output.once("open", function () {
			csv.fromStream(stream, {headers: true, delimiter: settings.fieldDelimiter})
				.validate(function (data) {
					if (count++ === 1) {
						headerValid = SIS.validateHeader(data);
						if (headerValid) {
							console.log("File header validated");
							SIS.headerValidated(output);
						} else {
							module.error("Fatal error: Invalid file header");
						}
						return headerValid;
					}
					return headerValid && SIS.validateData(data);
				})
				.on("data-invalid", function (data) {
					if (headerValid) {
						errorCount++;
						module.error("Invalid data found on row " + count, data);
					}
				})
				.transform(function (data) {
					SIS.transformData(data);
					return data;
				})
				.on("data", function (data) {
					SIS.processData(data, output);
				})
				.on("end", function () {
					output.end();
					console.log((count - 1) + " row(s) processed");
					console.log(errorCount + " row(s) with error");
					SIS.complete(errorCount > 0, fs.createReadStream(SIS.outputFile));
				});
		});
	},

	getRequestOptions: function (uri, stream) {
		var settings = require("./sis-settings");
		var result = {
			uri: settings.host + '/endpoint' + uri,
			auth: {
				user: settings.user,
				pass: settings.password
			}
		};
		if (stream) {
			result.body = stream;
		}
		return result;
	},

	handleReferenceCode: function (value, success) {
		var constants = require("./sis-constants");
		var code = value.split(" ").find(item => item.length === constants.referenceCodeLength);
		if (code) {
			console.log("Feed file uploaded. SIS Reference code " + code);
			success(code);
		} else {
			this.error("Unable to fetch reference code from SIS data set status.");
		}
	},

	pollStatus: function (pollOptions, pollCount, complete) {
		var xml = require("xml2js");
		var requestPromise = require("request-promise");
		var settings = require("./sis-settings");
		var module = this;
		requestPromise.get(pollOptions).then(function (body) {
			xml.parseString(body, function (err, result) {
				var queued = parseInt(result.dataSetStatus.queuedCount[0]);
				if (queued) {
					if (pollCount > settings.pollMaxAttempts) {
						module.error("Polling timeout. " + queued + " record(s) still processing. Please refer to Blackboard SIS logs.");
						complete();
					} else {
						console.log("Polling attempt " + pollCount + ": " + queued + " more record(s) queued for processing. Wait for " + (settings.pollInterval / 1000) + " second(s).");
						setTimeout(() => module.pollStatus(pollOptions, pollCount + 1, complete), settings.pollInterval);
					}
				} else {
					console.log("Job completed according to SIS polling status");
					complete();
				}
			});
		}).catch(error => module.error("Error in SIS status polling " + error.statusCode));
	},

	error: function (message, arg) {
		var constants = require("./sis-constants");
		arg ? console.error(constants.escapeChar + "[91m" + message + "\n", arg, constants.escapeChar + "[0m") : console.error(constants.escapeChar + "[91m" + message + constants.escapeChar + "[0m");
	}
}