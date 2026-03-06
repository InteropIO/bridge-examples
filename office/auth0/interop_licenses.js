
const CLAIM_NAMESPACE = 'https://interop.io';
const USE_SECRETS_LICENSE = false;
// list client ids for applications that needs licenses
const CLIENT_IDS = [
    '' //todo: YourApp's ClientId
];

/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onExecutePostLogin = async (event, api) => {

    if (CLIENT_IDS.includes(event.client.client_id)) {
        if (event.user.app_metadata && event.user.app_metadata.io_cb_license_key) {
            const io_cb_license_key = event.user.app_metadata.io_cb_license_key;

            if (io_cb_license_key) {
                api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}/io_cb_license_key`, io_cb_license_key);
            }
        }
        else {
            // todo: replace with your form id
            api.prompt.render('ap_dmiQhNpjgwtTJUnQopxjFB');
        }
    }
};


/**
 * Handler that will be invoked when this action is resuming after an external redirect. If your
 * onExecutePostLogin function does not perform a redirect, this function can be safely ignored.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onContinuePostLogin = async (event, api) => {
    if (CLIENT_IDS.includes(event.client.client_id)) {
        const io_cb_license_key = event.prompt?.fields?.io_cb_license_key ?? (USE_SECRETS_LICENSE ? event.secrets['IO_CB_LICENSE_KEY'] : undefined);

        if (io_cb_license_key) {
            api.user.setAppMetadata("io_cb_license_key", io_cb_license_key);
            api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}/io_cb_license_key`, io_cb_license_key);
        }
        else {
            api.access.deny("io.Connect Browser License key required.");
        }
    }
};
