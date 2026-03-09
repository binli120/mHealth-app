export const ADDRESS_VALIDATE_RUNTIME = "nodejs"

export const STATE_CODE_LENGTH = 2
export const DEFAULT_ZIP_CODE = ""
export const ZIP_CODE_LENGTH = 5

export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
export const NOMINATIM_FORMAT = "jsonv2"
export const NOMINATIM_ADDRESS_DETAILS = "1"
export const NOMINATIM_RESULT_LIMIT = "3"
export const NOMINATIM_COUNTRY_CODES = "us"
export const REQUEST_ACCEPT_LANGUAGE = "en-US"
export const REQUEST_USER_AGENT = "mhealth-app-address-validation/1.0"

export const ERROR_ADDRESS_LOOKUP_UNAVAILABLE = "Address lookup service is unavailable."
export const ERROR_INVALID_ADDRESS_PAYLOAD = "Invalid address payload."
export const ERROR_VALIDATE_ADDRESS_FAILED = "Unable to validate address."
export const ERROR_LOG_PREFIX = "Address validation failed"

export const MESSAGE_NO_MATCHING_ADDRESS = "No matching address found. Please check the address details."
export const MESSAGE_ADDRESS_VALIDATED = "Address validated successfully."
export const MESSAGE_ADDRESS_MISMATCH = "Address found, but state or ZIP did not match exactly."
