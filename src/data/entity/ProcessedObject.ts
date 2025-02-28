import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ObjectType {
    EMAIL = "email",
    ATTACHMENT = "attachment",
    REMINDER = "reminder",
    CALENDAR_EVENT = "calendar_event",
    MEETING_RECORDING = "meeting_recording",
    DOCUMENT = "document",
    IMAGE = "image",
    VIDEO = "video",
    URL_LINK = "url_link",
    USER = "user",
    MESSAGE = "message",
    NOTE = "note",
    VOICE_NOTE = "voice_note",
}

@Entity('processed_objects')
export class ProcessedObject {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('uuid')
    project_id!: string;

    @Column('text')
    thread_id!: string;

    @Column('text')
    message_id!: string;

    @Column({
        type: 'varchar',
        enum: ObjectType,
    })
    type!: ObjectType;

    @Column('text')
    result!: string;

    @Column({ type: 'datetime' })
    object_timestamp!: Date;

    @CreateDateColumn()
    created_at!: Date;
} 