"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
/**
 * Validate request using Zod schema
 */
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            // Validate body
            if (schema.body) {
                req.body = await schema.body.parseAsync(req.body);
            }
            // Validate query
            if (schema.query) {
                req.query = await schema.query.parseAsync(req.query);
            }
            // Validate params
            if (schema.params) {
                req.params = await schema.params.parseAsync(req.params);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.validate = validate;
//# sourceMappingURL=validation.middleware.js.map
