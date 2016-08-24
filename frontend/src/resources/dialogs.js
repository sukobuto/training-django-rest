import {Confirm} from './dialogs/confirm'
import {Prompt} from './dialogs/prompt'
import {Reply} from './dialogs/reply'
import {Blocker} from './dialogs/blocker'
import {Upload} from './dialogs/upload'
import {DialogService} from 'aurelia-dialog'

export class Dialogs {
	static inject = [DialogService];

	constructor(dialogService) {
		this.dialogService = dialogService;
	}

	open(viewModel, model) {
		return this.dialogService.open({viewModel, model});
	}

	confirm(question, message) {
	  return this.dialogService.open({viewModel: Confirm, model: {question, message}})
  }

	prompt(question) {
		return this.dialogService.open({viewModel: Prompt, model: question});
	}

	/**
	 * @param {ReplyModel} model
	 * @returns {*|{error, options}|Window}
	 */
	reply(model) {
		return this.dialogService.open({viewModel: Reply, model: model});
	}

	block(message = '') {
		let block = { message, blocking: true };
		setTimeout(() => {
			this.dialogService.open({viewModel: Blocker, model: block});
		}, 50);
		return () => {
			if (block.closing) return;
			block.closing = true;
			let timer = setInterval(() => {
				if (block.controller) {
					block.controller.close();
					clearInterval(timer);
				}
			}, 400);
		}
	}

	/**
	 * @param {UploadModel} model
	 * @returns {*|{error, options}|Window}
	 */
	upload(model) {
		return this.dialogService.open({viewModel: Upload, model: model});
	}

}

export class ReplyModel {

	title = '返信';
	description = '';
	content = null;
	bodyLabel = null;
	body = '';
	actionLabel = null;
	action = null;

}

export class UploadModel {
	
	title = 'アップロード';
	description = '';
	name = 'file';
	actionLabel = 'アップロード';
	cancelLabel = 'キャンセル';
	action = null;

}
