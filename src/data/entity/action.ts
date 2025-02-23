import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class FyxerAction {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    actionName!: string;

    @Column('text')
    actionData!: string;

    @Column()
    createdAt!: Date;

    setActionData(data: any) {
        this.actionData = JSON.stringify(data);
    }

    getActionData<T>(): T {
        return JSON.parse(this.actionData);
    }
}