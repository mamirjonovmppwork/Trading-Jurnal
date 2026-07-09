const client = require("../config/googleAuth");

const verifyGoogleToken = async (token) => {

    const ticket = await client.verifyIdToken({

        idToken: token,

        audience: process.env.GOOGLE_CLIENT_ID

    });

    return ticket.getPayload();

};

module.exports = {
    verifyGoogleToken
};