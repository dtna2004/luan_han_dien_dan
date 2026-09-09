const { ObjectId } = require('mongodb');
const { getDb } = require('../../lib/mongodb');
const {
    verifyPassword,
    hashPassword,
    signToken,
    setAuthCookie,
    clearAuthCookie,
    getUserFromRequest,
    getAdminEmails,
} = require('../../lib/auth');

function usernameFromEmail(email) {
    const local = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');
    return (local || 'admin').slice(0, 30).padEnd(3, '0');
}

async function ensureUniqueUsername(users, base) {
    let candidate = base;
    let suffix = 0;
    // eslint-disable-next-line no-await-in-loop
    while (await users.findOne({ username: candidate })) {
        suffix += 1;
        candidate = `${base}${suffix}`.slice(0, 30);
    }
    return candidate;
}

async function handleLogin(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    try {
        const { identifier, password } = req.body || {};
        if (!identifier || !password) {
            res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập/email và mật khẩu.' });
            return;
        }

        const clean = String(identifier).trim().toLowerCase();
        const db = await getDb();
        const users = db.collection('users');

        let user = await users.findOne({ $or: [{ email: clean }, { username: clean }] });

        // Bootstrap: nếu chưa có tài khoản nào ứng với email admin này, và người
        // dùng nhập đúng ADMIN_PASSWORD, tự tạo tài khoản admin luôn.
        if (!user) {
            const adminEmails = getAdminEmails();
            const adminPassword = process.env.ADMIN_PASSWORD;
            const isAdminEmail = adminEmails.includes(clean) && clean.includes('@');
            if (isAdminEmail && adminPassword && password === adminPassword) {
                const username = await ensureUniqueUsername(users, usernameFromEmail(clean));
                const doc = {
                    username,
                    display_name: 'Quản trị viên',
                    email: clean,
                    password_hash: await hashPassword(adminPassword),
                    role: 'admin',
                    banned: false,
                    created_at: new Date(),
                };
                const result = await users.insertOne(doc);
                user = { ...doc, _id: result.insertedId };
            } else {
                res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng.' });
                return;
            }
        } else {
            const ok = await verifyPassword(password, user.password_hash);
            if (!ok) {
                res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng.' });
                return;
            }
        }

        if (user.banned) {
            res.status(403).json({ error: 'Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.' });
            return;
        }

        // Nếu email nằm trong danh sách admin mà tài khoản chưa có quyền admin thì nâng cấp
        if (user.role !== 'admin' && getAdminEmails().includes(user.email)) {
            await users.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
            user.role = 'admin';
        }

        const token = signToken(user);
        setAuthCookie(res, token);

        res.status(200).json({
            user: {
                username: user.username,
                display_name: user.display_name || user.username,
                role: user.role,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
    }
}

async function handleRegister(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }

    try {
        const { username, email, password, display_name } = req.body || {};

        if (!username || !email || !password) {
            res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập, email và mật khẩu.' });
            return;
        }
        if (String(password).length < 6) {
            res.status(400).json({ error: 'Mật khẩu cần tối thiểu 6 ký tự.' });
            return;
        }
        const cleanUsername = String(username).trim().toLowerCase();
        const cleanEmail = String(email).trim().toLowerCase();
        if (!/^[a-z0-9_.]{3,30}$/.test(cleanUsername)) {
            res.status(400).json({
                error: 'Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm/gạch dưới, từ 3-30 ký tự.',
            });
            return;
        }

        const db = await getDb();
        const users = db.collection('users');

        const existing = await users.findOne({
            $or: [{ email: cleanEmail }, { username: cleanUsername }],
        });
        if (existing) {
            res.status(409).json({ error: 'Email hoặc tên đăng nhập đã được sử dụng.' });
            return;
        }

        const passwordHash = await hashPassword(password);
        const isAdmin = getAdminEmails().includes(cleanEmail);

        const doc = {
            username: cleanUsername,
            display_name: (display_name && String(display_name).trim()) || cleanUsername,
            email: cleanEmail,
            password_hash: passwordHash,
            role: isAdmin ? 'admin' : 'user',
            banned: false,
            created_at: new Date(),
        };

        const result = await users.insertOne(doc);
        const user = { ...doc, _id: result.insertedId };

        const token = signToken(user);
        setAuthCookie(res, token);

        res.status(201).json({
            user: {
                username: user.username,
                display_name: user.display_name,
                role: user.role,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại sau.' });
    }
}

async function handleLogout(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method không được hỗ trợ' });
        return;
    }
    clearAuthCookie(res);
    res.status(200).json({ ok: true });
}

async function handleMe(req, res) {
    const payload = getUserFromRequest(req);
    if (!payload) {
        res.status(200).json({ user: null });
        return;
    }

    try {
        if (!ObjectId.isValid(payload.uid)) {
            clearAuthCookie(res);
            res.status(200).json({ user: null });
            return;
        }
        const db = await getDb();
        const dbUser = await db.collection('users').findOne({ _id: new ObjectId(payload.uid) });

        if (!dbUser || dbUser.banned) {
            clearAuthCookie(res);
            res.status(200).json({ user: null, banned: !!(dbUser && dbUser.banned) });
            return;
        }

        res.status(200).json({
            user: {
                username: dbUser.username,
                display_name: dbUser.display_name || dbUser.username,
                role: dbUser.role,
            },
        });
    } catch (err) {
        console.error(err);
        // Nếu DB tạm lỗi, vẫn cho dùng thông tin trong token để tránh văng người dùng ra ngoài
        res.status(200).json({
            user: { username: payload.username, display_name: payload.display_name || payload.username, role: payload.role },
        });
    }
}

module.exports = async (req, res) => {
    const { action } = req.query || {};

    switch (action) {
        case 'login':
            return handleLogin(req, res);
        case 'register':
            return handleRegister(req, res);
        case 'logout':
            return handleLogout(req, res);
        case 'me':
            return handleMe(req, res);
        default:
            res.status(404).json({ error: 'Không tìm thấy endpoint.' });
    }
};