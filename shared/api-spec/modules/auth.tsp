import "@typespec/http";
import "../common/errors.tsp";

using Http;

namespace CostumeApp.Auth;

model LoginRequest {
    @minLength(6)
    login: string;

    @minLength(12)
    password: string;
}

model LoginSuccessResponse {
    accessToken: string;

    user: {
        login: string;
        name: string;
    };
}

model RefreshSuccessResponse {
    accessToken: string;
}
@route("/auth")
interface AuthOperations {
    
    @useAuth([])
    @post
    @route("login")
    login(@body body: LoginRequest): {
        @statusCode statusCode: 200;
        @header("Set-Cookie")
    refreshToken: string;
        @body response: LoginSuccessResponse;
    } | Common.Error;

    @useAuth([])
    @post
    @route("refresh")
    refresh(
        @header("Cookie") cookie: string
    ) : {
        @statusCode statusCode: 200;
        @body response: RefreshSuccessResponse;
    } | Common.Error;

    @post
    @route("logout")
    logout(): {
        @statusCode statusCode: 204;
        @header("Set-Cookie") deleteCookie: string;
    } | Common.Error
}