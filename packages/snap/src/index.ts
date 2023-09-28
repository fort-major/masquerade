import { OnRpcRequestHandler } from '@metamask/snaps-types';
import { ErrorCode, SNAP_METHODS, ZSnapRPCRequest, err, toCBOR, zodParse } from '@fort-major/masquerade-shared';
import { protected_handleIdentityLogin, handleIdentityLinkRequest, handleIdentityUnlinkRequest, protected_handleIdentityAdd, protected_handleStateGetOriginData, handleEntropyGet, handleIdentityLogoutRequest } from './protocols';
import { guardMethods as guardProtectedMethods } from './utils';


export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
    const req = zodParse(ZSnapRPCRequest, request);

    // restrict access to protected methods to be only executed
    // from the Internet Computer Snap website
    guardProtectedMethods(req.method, origin);

    let result: Promise<any>;

    switch (request.method) {
        // ------ STATE RELATED METHODS -----------
        case SNAP_METHODS.state.protected_getOriginData: {
            result = protected_handleStateGetOriginData(req.params.body);
            break;
        }

        // ------ IDENTITY RELATED METHODS --------
        case SNAP_METHODS.identity.protected_add: {
            result = protected_handleIdentityAdd(req.params.body);
            break;
        }

        case SNAP_METHODS.identity.protected_login: {
            result = protected_handleIdentityLogin(req.params.body);
            break;
        }

        case SNAP_METHODS.identity.requestLogout: {
            result = handleIdentityLogoutRequest(origin);
            break;
        }

        case SNAP_METHODS.identity.requestLink: {
            result = handleIdentityLinkRequest(req.params.body, origin);
            break;
        }

        case SNAP_METHODS.identity.requestUnlink: {
            result = handleIdentityUnlinkRequest(req.params.body, origin);
            break;
        }

        // ------ ENTROPY RELATED METHODS ---------
        case SNAP_METHODS.entropy.get: {
            result = handleEntropyGet(req.params.body, origin);
            break;
        }

        // ----------------------------------------

        default: {
            err(ErrorCode.INVALID_RPC_METHOD, request.method);
        }
    }

    return toCBOR(await result);
};