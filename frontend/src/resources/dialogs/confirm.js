import {DialogController} from 'aurelia-dialog'

export class Confirm {
	static inject = [DialogController];

	constructor(controller) {
		this.controller = controller;

		controller.settings.lock = false;
	}

	activate(model) {
		this.model = model;
	}
}
