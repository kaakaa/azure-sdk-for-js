// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * This sample demonstrates how the sendDirectNotification() method can be used to send a direct
 * notification using APNs.  This sends a JSON message to an APNs given device token and returns
 * a Tracking ID which can be used for troubleshooting with the Azure Notification Hubs team.
 *
 * See https://docs.microsoft.com/rest/api/notificationhubs/direct-send
 * to learn about Direct Send.
 *
 *
 * @summary Demonstrates how to send direct notifications using Azure Notification Hubs
 * @azsdk-weight 100
 */

import {
  NotificationDetails,
  NotificationOutcomeState,
} from "@azure/notification-hubs/models/notificationDetails";
import {
  NotificationHubsClientContext,
  createClientContext,
} from "@azure/notification-hubs/client";
import { createFcmLegacyNotification } from "@azure/notification-hubs/models/notification";
import { delay } from "@azure/core-util";
import { getNotificationOutcomeDetails } from "@azure/notification-hubs/client/getNotificationOutcomeDetails";
import { sendDirectNotification } from "@azure/notification-hubs/client/sendDirectNotification";

// Load the .env file if it exists
import * as dotenv from "dotenv";
dotenv.config();

// Define connection string and hub name
const connectionString = process.env.NOTIFICATIONHUBS_CONNECTION_STRING || "<connection string>";
const hubName = process.env.NOTIFICATION_HUB_NAME || "<hub name>";

// Define message constants
const DUMMY_REGISTRATION = "bk3RNwTe3H0:CI2k_HHwgIpoDKCIZvvDMExUdFQ3P1";
const gcmRegistrationId = process.env.FCM_REGISTRATION_ID || DUMMY_REGISTRATION;

async function main() {
  const context = createClientContext(connectionString, hubName);

  const messageBody = `{
	"notification":{
		"title":"Notification Hub Test Notification",
		"body":"This is a sample notification delivered by Azure Notification Hubs."
	},
	"data":{
		"property1":"value1",
		"property2":42
	}
}`;

  const notification = createFcmLegacyNotification({
    body: messageBody,
  });

  const result = await sendDirectNotification(context, gcmRegistrationId, notification);

  console.log(`Direct send Tracking ID: ${result.trackingId}`);
  console.log(`Direct send Correlation ID: ${result.correlationId}`);

  // Only available in Standard SKU and above
  if (result.notificationId) {
    console.log(`Direct send Notification ID: ${result.notificationId}`);

    const results = await getNotificationDetails(context, result.notificationId);
    if (results) {
      console.log(JSON.stringify(results, null, 2));
    }
  }
}

async function getNotificationDetails(
  context: NotificationHubsClientContext,
  notificationId: string
): Promise<NotificationDetails | undefined> {
  let state: NotificationOutcomeState = "Enqueued";
  let count = 0;
  let result: NotificationDetails | undefined;
  while ((state === "Enqueued" || state === "Processing") && count++ < 10) {
    try {
      result = await getNotificationOutcomeDetails(context, notificationId);
      state = result.state!;
    } catch (e) {
      // Possible to get 404 for when it doesn't exist yet.
    }

    await delay(1000);
  }

  return result;
}

main().catch((err) => {
  console.log("sendDirectNotification Sample: Error occurred: ", err);
  process.exit(1);
});
