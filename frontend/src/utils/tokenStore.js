let accessToken = null;
let onChange = null;

export const tokenStore = {
    getToken: () => accessToken,
    setToken: (token) => {
        accessToken = token;
        if (onChange) onChange(token);
    },
    registerListener: (cb) => { onChange = cb; },
};