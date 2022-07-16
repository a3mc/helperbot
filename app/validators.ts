// Contains helper validating methods.

// Validate entered time string. It should be strictly in 'hh:mm' format.
export function checkTimeFormat( time: string ): boolean {
    if ( !time.match( /\d\d:\d\d/ ) ) return false;
    const timeArr = time.split( ':' );
    if (
        parseInt( time[0] ) > 23 ||
        parseInt( time[0] ) < 0 ||
        parseInt( time[1] ) < 0 ||
        parseInt( time[1] ) > 59
    ) {
        return false;
    }
    return true;
}

// Validate the user's UTC timezone offset.
export function checkTimezoneFormat( offset: number ): boolean {
    return (
        isNaN( offset ) ||
        offset < -12 ||
        offset > 12
    );
}
