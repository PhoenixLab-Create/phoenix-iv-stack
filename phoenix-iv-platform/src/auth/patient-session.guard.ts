import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PatientSessionService } from './patient-session.service';

/**
 * Applied to patient-facing routes only (intake submission, consent
 * signing). Reads a bearer token the same way staff auth does, but validates
 * it as a single-visit patient session rather than a user JWT — patients
 * never have a `req.user`. On success, sets req.patientSession = { visitId }
 * and also touches the session's expiry, implementing the idle-timeout
 * extension on activity.
 *
 * A patient session token for visit A can never be used to access visit B —
 * the guard also checks the :visitId route param against the token's visitId.
 */
@Injectable()
export class PatientSessionGuard implements CanActivate {
  constructor(private readonly sessions: PatientSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing patient session token');
    }
    const token = authHeader.slice('Bearer '.length);
    const { sessionId, visitId } = await this.sessions.validate(token);

    const routeVisitId = req.params?.visitId;
    if (routeVisitId && routeVisitId !== visitId) {
      throw new UnauthorizedException('This session is not valid for the requested visit');
    }

    req.patientSession = { sessionId, visitId };
    await this.sessions.touch(sessionId);
    return true;
  }
}
