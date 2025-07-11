import Bot from "./views/Bot.js";
import Dashboard from "./views/Dashboard.js";
import ListBot from "./views/ListBot.js";

const pathToRegex = path => new RegExp("^" + path.replace(/\//g, "\\/").replace(/:\w+/g, "([^\\/]+)") + "$");


const getParams = match => {
    const values = match.result.slice(1);
    const keys = Array.from(match.route.path.matchAll(/:(\w+)/g)).map(result => result[1]);

    return Object.fromEntries(keys.map((key, i) => {
        return [key, values[i]];
    }));
};

const navigateTo = url => {
    history.pushState(null, null, url);
    router();
};

const router = async () => {
    const routes = [
        { path: "/dashboard", view: Dashboard },
        { path: "/bot/new", view: Bot },
        { path: "/bot/list", view: ListBot },
        { path: "/bot/:_key", view: Bot },
        { path: "/", view: Dashboard },

    ];

    // Test each route for potential match
    const potentialMatches = routes.map(route => {
        return {
            route: route,
            result: location.pathname.match(pathToRegex(route.path))
        };
    });

    let match = potentialMatches.find(potentialMatch => potentialMatch.result !== null);

    if (!match) {
        match = {
            route: routes[0],
            result: [location.pathname]
        };
    }

    const view = new match.route.view(getParams(match));

    await view.init();
    document.querySelector("#menu").innerHTML = await view.getMenu();
    document.querySelector("#app").innerHTML = await view.getHtml();
};

window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {

    document.body.addEventListener("click", e => {
                
        if (e.target.matches("[data-link]")) {
            
            e.preventDefault();
            navigateTo(e.currentTarget.href);

        }
    });

    router();
});