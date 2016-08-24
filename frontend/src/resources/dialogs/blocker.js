import {inject} from 'aurelia-framework'
import {DialogController} from 'aurelia-dialog'

@inject(DialogController)
export class Blocker {

	constructor(controller) {
		this.controller = controller;
	}

	activate(block) {
		this.block = block;
		block.controller = this.controller;
	}

}