module.exports = {

	loadCsv: function (SIS) {
		var fs = require("fs");
		var csv = require("fast-csv");
		var settings = require("./sis-settings");
		var inputPath = this.getFullPath(SIS.inputFolder, SIS.inputFile);
		if (fs.existsSync(inputPath)) {
			var stream = fs.createReadStream(inputPath);
			console.log('Input file ' + inputPath + ' loaded');
			if (!fs.existsSync(SIS.outputFolder)) {
				console.log('Creating output folder ' + SIS.outputFolder);
				fs.mkdirSync(SIS.outputFolder);
			}
			var outputs = SIS.outputFiles ? SIS.outputFiles.map(outputFile => fs.createWriteStream(this.getFullPath(SIS.outputFolder, outputFile))) : [];
			var count = 1, errorCount = 0, headerValid = false, module = this;
			this.openOutputFiles(outputs, SIS.outputFiles, 0, () => {
				console.log(outputs.length + ' output file(s) opened');
				csv.fromStream(stream, {headers: true, delimiter: settings.fieldDelimiter})
					.validate(data => {
						if (count++ === 1) {
							headerValid = SIS.validateHeader == undefined || SIS.validateHeader(data);
							if (headerValid) {
								console.log(SIS.validateHeader ? "File header validated" : "File header validation skipped");
								SIS.headerValidated && SIS.headerValidated(outputs);
							} else {
								module.error("Fatal error: Invalid file header");
							}
							return headerValid;
						}
						return headerValid && (SIS.validateData == undefined || SIS.validateData(data));
					})
					.on("data-invalid", data => {
						headerValid && module.error("Invalid data found on row " + count, data);
						errorCount++;
					})
					.transform(data => {
						headerValid && SIS.transformData && SIS.transformData(data);
						return data;
					})
					.on("data", data => {
						headerValid && SIS.processData && SIS.processData(data, outputs);
					})
					.on("end", () => {
						outputs.forEach(output => output.end());
						console.log((count - 1) + " row(s) processed");
						console.log(errorCount + " row(s) with error");
						SIS.complete(headerValid, SIS.outputFiles ? SIS.outputFiles.map(outputFile => fs.createReadStream(module.getFullPath(SIS.outputFolder, outputFile))) : []);
					});
			});
		} else {
			this.error("File error: " + inputPath + " does not exist");
			SIS.complete();
		}
	},

	openOutputFiles: function (outputs, files, index, callback) {
		var module = this;
		if (outputs.length > 0) {
			console.log('Opening output file ' + files[index]);
			if (outputs.length > index) {
				outputs[index].once("open", () => index === outputs.length - 1 ?
					callback() : module.openOutputFiles(outputs, files, index + 1, callback));
			}
		} else {
			console.log('No output file specified');
			callback();
		}
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
		stream && (result.body = stream);
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
	
	uploadWithPolling: function (url, stream, callback) {
		var requestPromise = require("request-promise");
		requestPromise.post(this.getRequestOptions(url, stream))
			.then(body => this.handleReferenceCode(body, code => this.pollStatus(code, callback)))
			.catch(error => this.error("Error code from Bb server " + error.statusCode));
	},

	pollStatus: function (code, complete) {
		var options = this.getRequestOptions('/dataSetStatus/' + code);
		this.pollStatusByCount(options, 1, complete);
	},

	pollStatusByCount: function (pollOptions, pollCount, complete) {
		var xml = require("xml2js");
		var requestPromise = require("request-promise");
		var settings = require("./sis-settings");
		var module = this;
		requestPromise.get(pollOptions).then(body => {
			xml.parseString(body, (err, result) => {
				var queued = parseInt(result.dataSetStatus.queuedCount[0]);
				if (queued) {
					if (pollCount > settings.pollMaxAttempts) {
						module.error("Polling timeout. " + queued + " record(s) still processing. Please refer to Blackboard SIS logs.");
						complete();
					} else {
						console.log("Polling attempt " + pollCount + ": " + queued + " more record(s) queued for processing. Wait for " + (settings.pollInterval / 1000) + " second(s).");
						setTimeout(() => module.pollStatusByCount(pollOptions, pollCount + 1, complete), settings.pollInterval);
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
	},

	getFullPath: function (folder, file) {
		return folder ? folder + '/' + file : file;
	}
}