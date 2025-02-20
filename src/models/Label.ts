export interface ILabel {
    name: string;
    description: string;
    parent: ILabel | null;
}

class Label implements ILabel {
    constructor(public name: string, public description: string, public parent: ILabel | null) {
    }
}



export class LabelFactory {
    static getLabel(name: string): ILabel {
        const label = this.temporaryLabels.find(label => label.name === name);
        if (!label) {
            throw new Error(`Label ${name} not found`);
        }
        return new Label(label.name, label.description, label.parent);
    }

    static temporaryLabels: Array<ILabel> = [
        {
            name: "Primary",
            description: "Primary label",
            parent: null
        },
        {
            name: "Work",
            description: "Work label",
            parent: null
        },
        {
            name: "Social",
            description: "Social label",
            parent: null
        },
        {
            name: "Spam",
            description: "Spam label",
            parent: null
        },
        {
            name: "Updates",
            description: "Updates label",
            parent: null
        },
        {
            name: "Promotions",
            description: "Promotions label",
            parent: null
        },
        {
            name: "Other",
            description: "Other label",
            parent: null
        },
    ];

    static isValidLabel(labelName: string): boolean {
        return this.temporaryLabels.some(label => label.name === labelName);
    }
}