import {
	IHookFunctions,
	IWebhookFunctions,
} from 'n8n-core';

import {
	IDataObject,
	INodeTypeDescription,
	INodeType,
	IWebhookResponseData,
} from 'n8n-workflow';

import {
	woocommerceApiRequest,
	getAutomaticSecret,
} from './GenericFunctions';

import { createHmac } from 'crypto';

export class WooCommerceTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WooCommerce Trigger',
		name: 'wooCommerceTrigger',
		icon: 'file:woocommerce.png',
		group: ['trigger'],
		version: 1,
		description: 'Handle WooCommerce events via webhooks',
		defaults: {
			name: 'WooCommerce Trigger',
			color: '#96588a',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'wooCommerceApi',
				required: true,
			}
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				default: '',
				options: [
					{
						name: 'coupon.created',
						value: 'coupon.created',
					},
					{
						name: 'coupon.updated',
						value: 'coupon.updated',
					},
					{
						name: 'coupon.deleted',
						value: 'coupon.deleted',
					},
					{
						name: 'customer.created',
						value: 'customer.created',
					},
					{
						name: 'customer.updated',
						value: 'customer.updated',
					},
					{
						name: 'customer.deleted',
						value: 'customer.deleted',
					},
					{
						name: 'order.created',
						value: 'order.created',
					},
					{
						name: 'order.updated',
						value: 'order.updated',
					},
					{
						name: 'order.deleted',
						value: 'order.deleted',
					},
					{
						name: 'product.created',
						value: 'product.created',
					},
					{
						name: 'product.updated',
						value: 'product.updated',
					},
					{
						name: 'product.deleted',
						value: 'product.deleted',
					},
				],
				description: 'Determines which resource events the webhook is triggered for.',
			},
		],

	};

	// @ts-ignore
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return false;
				}
				const endpoint = `/webhooks/${webhookData.webhookId}`;
				try {
					await woocommerceApiRequest.call(this, 'GET', endpoint);
				} catch (e) {
					return false;
				}
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = this.getCredentials('wooCommerceApi');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const event = this.getNodeParameter('event') as string;
				const secret = getAutomaticSecret(credentials!);
				const endpoint = '/webhooks';
				const body: IDataObject = {
					delivery_url: webhookUrl,
					topic: event,
					secret,
				};
				const { id } = await woocommerceApiRequest.call(this, 'POST', endpoint, body);
				webhookData.webhookId = id;
				webhookData.secret = secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const endpoint = `/webhooks/${webhookData.webhookId}`;
				try {
					await woocommerceApiRequest.call(this, 'DELETE', endpoint, {}, { force: true });
				} catch(error) {
					return false;
				}
				delete webhookData.webhookId;
				delete webhookData.secret;
				return true;
			},
		},
	};

	//@ts-ignore
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const headerData = this.getHeaderData();
		const webhookData = this.getWorkflowStaticData('node');
		//@ts-ignore
		if (headerData['x-wc-webhook-id'] === undefined) {
			return {};
		}
		//@ts-ignore
		const computedSignature = createHmac('sha256',webhookData.secret as string).update(req.rawBody).digest('base64');
		//@ts-ignore
		if (headerData['x-wc-webhook-signature'] !== computedSignature) {
			// Signature is not valid so ignore call
			return {};
		}
		return {
			workflowData: [
				this.helpers.returnJsonArray(req.body),
			],
		};
	}
}
