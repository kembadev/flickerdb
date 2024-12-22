const NODE_ERR_CODE_MESSAGES: Record<string, string> = {
	EACCESS: 'Access denied.',
	EPERM: 'This operation is not allowed by the file system.',
	ENOENT: 'The file does not exist.',
	EBUSY: 'The file is busy and cannot be accessed.',
	ENAMETOOLONG: 'The directory name is too long.',
	ENOSPC: 'There is no space on the drive.',
};

/** Get the reason describe by the node error code provided */
export function getReasonFromNodeErrCode(errorCode: unknown) {
	if (typeof errorCode !== 'string') return null;

	const reason = NODE_ERR_CODE_MESSAGES[errorCode] ?? null;
	return reason ? `[${errorCode}]${reason}` : null;
}
