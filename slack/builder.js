'use strict';

class SlackBuilder {
    constructor(base){
        this.str = base || "";
    }
    build() {
        return this.str;
    }
    isEmpty() {
        return this.str.length === 0;
    }
    text(txt) {
        this.str = `${this.str}${txt}`;
        return this;
    }
    add(tag, next) {
        this.str = next ? `${this.str} ${tag}${next}${tag} ` : `${tag}${this.str}${tag} `;
        return this;
    }
    b(next){
        return this.add("*", next);
    }
    del(next){
        return this.add("~", next);
    }
    i(next){
        return this.add("_", next);
    }
    a(title, href){
        this.str = `${this.str} <${href}|${title}>`
        return this;
    }
    code(next){
        return this.add("`", next);
    }
    pre(next) {
        return this.add("```", next);
    }
    comment(next) {
        this.str = next ? `${this.str}\n>>>\n${next}` : `>>>\n${this.str}`; 
        return this;
    }
    br() {
        this.str = `${this.str}\n`;
        return this;
    }
}

module.exports = SlackBuilder;