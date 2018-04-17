module.exports = {

	/* User name used in Blackboard SIS framework integration */
	user: '<USER_NAME>',

	/* Password used in Blackboard SIS framework integration */
	password: '<PASSWORD>',

	/* Base URL used in Blackboard SIS framework integration */
	host: 'https://<HOST>/webapps/bb-data-integration-flatfile-BBLEARN',

	/* Number of milliseconds between SIS status polling */
	pollInterval: 5000,

	/* Maximum number of attempts of SIS status polling */
	pollMaxAttempts: 10,

	/* Delimiter character between fields in CSV files */
	fieldDelimiter: "|"

}