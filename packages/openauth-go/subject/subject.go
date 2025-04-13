package subject

type SubjectValidator[T any] func(data any) (T, error)

type SubjectSchemas map[string]SubjectValidator[any]
