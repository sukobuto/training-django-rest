import {inject} from 'aurelia-framework';
import {DialogController} from 'aurelia-dialog';

@inject(DialogController)
export class Upload {

	uploading = false;

	constructor(controller) {
		this.controller = controller;
	}

	activate(model) {
		this.model = model;
		this.action = model.action;
	}

	async upload() {
		this.model.notSelected = !this.model.file.value;
		if (!this.model.notSelected) {
			this.uploading = true;
			let result = await this.action(this.model);
			this.uploading = false;
			if (result !== false) {
				this.controller.ok(result);
			}
		}
	}

}