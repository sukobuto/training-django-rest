import {inject} from 'aurelia-framework';
import {ApiClient} from "services";
import {Dialogs} from 'resources/dialogs';
let client = new ApiClient();

@inject(Dialogs)
export class App {

  todos = [];
  new_todo;
  active_todo = null;
  loading = false;

  /**
   * @param {Dialogs} dialogs
   */
  constructor(dialogs) {
    this.dialogs = dialogs;
    this.message = 'Hello Django REST Framework!';
  }

  resetNewTodo() {
    this.new_todo = {};
  }

  async activate() {
    window.page = this;
    this.resetNewTodo();
    this.readTodos();
  }

  async readTodos() {
    this.loading = true;
    try {
      this.todos = await client.get('todos/');
    } catch (e) {
      console.log(e);
    }
    this.loading = false;
  }

  async createTodo() {
    try {
      await client.post('todos/', this.new_todo);
    } catch (e) {
      console.log(e)
    }
    this.resetNewTodo();
    await this.readTodos();
  }

  async deleteTodo(todo) {
    let result = await this.dialogs.confirm("削除", todo.text + " を削除します。よろしいですか？");
    if (result.wasCancelled) return;
    try {
      await client.delete(`todos/${todo.id}/`);
    } catch (e) {
      console.log(e)
    }
    await this.readTodos();
  }

  openTodo(todo) {
    if (this.active_todo == todo) {
      this.active_todo = null;
    } else {
      this.active_todo = todo;
    }
  }

}
