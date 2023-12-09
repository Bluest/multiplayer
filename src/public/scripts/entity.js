import { Network } from './network.js';
import { Vector2 } from './vector2.js';

export class Entity {
    static nextID = 0;

    id;
    owner;
    destroyed = false;
    position = new Vector2();
    /** @type {Component[]} */
    components = [];

    /**
     * @param {number} [id]
     * @param {string} [owner]
     */
    constructor(id, owner) {
        this.id = id ? id : Entity.nextID++;
        this.owner = owner ? owner : Network.socketID;
    }

    /**
     * @param {class} component
     * @returns {Component}
     */
    addComponent(component) {
        const addedComponent = this.components[this.components.push(new component(this)) - 1];
        addedComponent.constructorName = addedComponent.constructor.name;
        return addedComponent;
    }

    /**
     * @param {class} component
     * @returns {Component | undefined}
     */
    getComponent(component) {
        return this.components.find(x => x instanceof component);
    }
}
