namespace Common;

@error
model Error{
    statusCode: int32;
    message: string;
    error?: string;
    code?: string;
    fieldErrors?: Record<string[]>;
}
