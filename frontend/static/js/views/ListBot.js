import AbstractView from "./AbstractView.js";

export default class extends AbstractView {
    constructor(params) {
        super(params);
        this.setTitle("Lista de Bots");
    }

    async init() {
        console.log("init");

        const response = await fetchData(`/bot/v1/listBot`, "GET");

        this.message = response || "Nenhuma resposta da aplicação.";
        console.log(this.message)
        this.list = response.list || [];
    }

   async getHtml() {
    let row = `
        <div class="card mb-3 border-info">
            <div class="card-header bg-info text-white">
                <strong>Status da Aplicação</strong>
            </div>
            <div class="card-body">
                <p><strong>Aplicação:</strong> ${this.message.application}</p>
                <p><strong>Status:</strong> ${this.message.status}</p>
                <p><strong>Horário:</strong> ${new Date(this.message.timestamp).toLocaleString()}</p>
                <p><strong>Mensagem:</strong> ${this.message.message}</p>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <strong>Lista de Bots</strong>
            </div>
            <div class="card-body">`;

    this.list.forEach(element => {
        row += `
            <div class="card mb-2">
                <div class="card-head">
                    <a id="${element._key}" class="btn btn-outline-primary form-control" href="/bot/${element.name}">
                        ${element.name}
                    </a>
                </div>
            </div>`;
    });

    row += `
            </div>
        </div>`;

    return row;
}


    async getMenu() {
        return `
            <ul class="nav nav-tabs justify-content-center">
                <li class="nav-item">
                    <a class="nav-link" href="/dashborad">WhatBot</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link active" href="#">Bots</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/bot/new">Novo Bot</a>
                </li>
            </ul>`;
    }
}
