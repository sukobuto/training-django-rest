import {inject} from 'aurelia-framework'
import {DialogController} from 'aurelia-dialog'

@inject(DialogController)
export class Reply {

	executing = false;

	constructor(controller) {
		this.controller = controller;
	}

	activate(model) {
		this.model = model;
		this.action = model.action;
	}

	async execute() {
		if (this.action) {
			this.executing = true;
			let result = await this.action(this.model);
			this.executing = false;
			if (result !== false) this.controller.ok(result);
		} else {
			this.controller.ok(this.model);
		}
	}

}