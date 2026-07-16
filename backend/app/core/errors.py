"""Domain exceptions + global handlers with friendly, non-leaky messages."""
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger("waaem.errors")


class AppError(Exception):
    """Base application error carrying an HTTP status + safe message."""

    status_code = status.HTTP_400_BAD_REQUEST
    message = "حدث خطأ غير متوقع."

    def __init__(self, message: str | None = None, status_code: int | None = None):
        if message:
            self.message = message
        if status_code:
            self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    message = "العنصر المطلوب غير موجود."


class ValidationAppError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    message = "البيانات المُرسلة غير صالحة."


class UnsupportedFileError(AppError):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    message = "نوع الملف غير مدعوم. الرجاء رفع ملفات PDF أو DOCX."


class EmptyUploadError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    message = "لم يتم رفع أي ملفات."


class AnalysisError(AppError):
    status_code = status.HTTP_502_BAD_GATEWAY
    message = "تعذّر تحليل الوثائق المرفوعة."


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content={"success": False, "message": exc.message})

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        logger.warning("request validation failed: %s", exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"success": False, "message": "البيانات المُرسلة غير صالحة."},
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        # Never expose internal errors to the client.
        logger.exception("unhandled error: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": "حدث خطأ داخلي. الرجاء المحاولة لاحقاً."},
        )
